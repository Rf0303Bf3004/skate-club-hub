ALTER TABLE public.iscrizioni_corsi
  ADD COLUMN IF NOT EXISTS forzata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_forzatura text,
  ADD COLUMN IF NOT EXISTS forzato_da uuid,
  ADD COLUMN IF NOT EXISTS forzato_at timestamptz;

CREATE OR REPLACE FUNCTION public.iscrizioni_corsi_valida_livello()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_liv_corso  text;
  v_nome_corso text;
  v_liv_atleta text;
  v_atleta     text;
  v_controlla  boolean := true;
begin
  -- Le righe gia presenti non vengono toccate: in aggiornamento si controlla
  -- solo se cambia il corso, cambia l'atleta o l'iscrizione viene riattivata.
  if TG_OP = 'UPDATE' then
    v_controlla := NEW.corso_id is distinct from OLD.corso_id
                or NEW.atleta_id is distinct from OLD.atleta_id
                or (coalesce(NEW.attiva,true) and not coalesce(OLD.attiva,true));
  end if;

  if v_controlla then
    select c.livello_richiesto, c.nome into v_liv_corso, v_nome_corso
      from public.corsi c where c.id = NEW.corso_id;

    if v_liv_corso is not null then
      select a.livello_attuale, a.cognome||' '||a.nome into v_liv_atleta, v_atleta
        from public.atleti a where a.id = NEW.atleta_id;

      if v_liv_corso is distinct from v_liv_atleta then
        if not coalesce(NEW.forzata,false)
           or coalesce(btrim(NEW.motivo_forzatura),'') = '' then
          raise exception
            '% e al livello % e il corso "%" chiede il livello %. Se l''iscrizione e voluta lo stesso, indica il motivo dell''eccezione e procedi.',
            coalesce(v_atleta,'L''atleta'),
            coalesce(v_liv_atleta,'non indicato'),
            coalesce(v_nome_corso,'scelto'),
            v_liv_corso;
        end if;
      end if;
    end if;
  end if;

  if coalesce(NEW.forzata,false) then
    if NEW.forzato_da is null then NEW.forzato_da := auth.uid(); end if;
    if NEW.forzato_at is null then NEW.forzato_at := now(); end if;
  end if;

  return NEW;
end $function$;

DROP TRIGGER IF EXISTS trg_iscrizioni_corsi_valida_livello ON public.iscrizioni_corsi;
CREATE TRIGGER trg_iscrizioni_corsi_valida_livello
  BEFORE INSERT OR UPDATE ON public.iscrizioni_corsi
  FOR EACH ROW EXECUTE FUNCTION public.iscrizioni_corsi_valida_livello();

CREATE OR REPLACE FUNCTION public.club_presentabile(p_club uuid DEFAULT NULL::uuid)
 RETURNS TABLE(esito text, ambito text, quanti integer, dettaglio text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_club uuid := coalesce(p_club, public.user_club_id());
  v_mod  text;
  v_da   date;
  v_al   date;
begin
  select m.modalita into v_mod from public.moduli_gestione_club m
   where m.club_id=v_club and m.area='ghiaccio' limit 1;
  select s.data_inizio, s.data_fine into v_da, v_al from public.stagioni s
   where s.club_id=v_club and coalesce(s.attiva,false) limit 1;

  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end, 'Corsi senza istruttore', count(*)::int,
         coalesce(string_agg(c.nome, ', '), 'tutti i corsi hanno almeno un istruttore')
    from public.corsi c where c.club_id=v_club and coalesce(c.attivo,true)
     and not exists (select 1 from public.corsi_istruttori ci where ci.corso_id=c.id);
  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end, 'Corsi senza prezzo', count(*)::int,
         coalesce(string_agg(c.nome, ', '), 'tutti i corsi hanno un prezzo')
    from public.corsi c where c.club_id=v_club and coalesce(c.attivo,true)
     and coalesce(c.costo_mensile,0)+coalesce(c.costo_annuale,0) = 0;
  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end, 'Corsi fuori dalle ore di ghiaccio', count(*)::int,
         coalesce(string_agg(c.nome||' ('||c.giorno||' '||to_char(c.ora_inizio,'HH24:MI')||')', ', '),
                  'tutti i corsi stanno dentro le fasce dichiarate')
    from public.corsi c where c.club_id=v_club and coalesce(c.attivo,true) and c.usa_ghiaccio
     and c.giorno is not null and c.ora_inizio is not null
     and not exists (select 1 from public.disponibilita_ghiaccio d
                      where d.club_id=v_club and d.giorno=c.giorno and coalesce(d.tipo,'ghiaccio')='ghiaccio'
                        and c.ora_inizio >= d.ora_inizio and c.ora_fine <= d.ora_fine);
  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end, 'Corsi oltre la capienza', count(*)::int,
         coalesce(string_agg(x.nome||' ('||x.iscritti||'/'||x.capienza_max||')', ', '), 'nessun corso oltre i posti')
    from (select c.nome, c.capienza_max,
                 (select count(*) from public.iscrizioni_corsi ic where ic.corso_id=c.id and coalesce(ic.attiva,true)) as iscritti
            from public.corsi c where c.club_id=v_club and coalesce(c.attivo,true)) x
   where x.capienza_max is not null and x.iscritti > x.capienza_max;
  return query
  select case when count(*)=0 then 'OK' else 'ATTENZIONE' end, 'Atleti senza iscrizione a un corso', count(*)::int,
         coalesce(string_agg(a.cognome||' '||a.nome, ', '), 'tutti gli atleti hanno un corso')
    from public.atleti a where a.club_id=v_club and coalesce(a.attivo,true) and a.ospite_di_campo_id is null
     and not exists (select 1 from public.iscrizioni_corsi ic where ic.atleta_id=a.id and coalesce(ic.attiva,true));

  -- Le eccezioni dichiarate (forzata + motivo) non sono un difetto: si citano, non si contano.
  return query
  with base as (
    select a.cognome||' '||a.nome||' ('||a.livello_attuale||' in '||c.nome||')' as chi,
           (coalesce(ic.forzata,false) and coalesce(btrim(ic.motivo_forzatura),'') <> '') as dichiarata
      from public.iscrizioni_corsi ic
      join public.atleti a on a.id=ic.atleta_id
      join public.corsi  c on c.id=ic.corso_id
     where a.club_id=v_club and coalesce(ic.attiva,true) and coalesce(a.attivo,true)
       and c.livello_richiesto is not null
       and c.livello_richiesto is distinct from a.livello_attuale
       and c.nome is distinct from a.livello_attuale
  )
  select case when count(*) filter (where not dichiarata)=0 then 'OK' else 'DA SISTEMARE' end,
         'Atleti nel corso sbagliato per il loro livello',
         (count(*) filter (where not dichiarata))::int,
         coalesce(string_agg(chi, ', ') filter (where not dichiarata),
                  'ogni atleta e nel corso che prepara il suo livello successivo')
         || case when count(*) filter (where dichiarata) > 0
                 then ' - '||(count(*) filter (where dichiarata))||' eccezioni dichiarate, non conteggiate'
                 else '' end
    from base;

  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end, 'Atleti con anagrafica di fatturazione incompleta', count(*)::int,
         coalesce(string_agg(a.cognome||' '||a.nome, ', '), 'tutte le schede sono complete')
    from public.atleti a where a.club_id=v_club and coalesce(a.attivo,true) and a.ospite_di_campo_id is null
     and not coalesce(a.deroga_anagrafica,false)
     and (coalesce(a.indirizzo,'')='' or coalesce(a.cap,'')='' or coalesce(a.citta,'')=''
          or coalesce(a.genitore1_nome,'')='' or coalesce(a.genitore1_email,'')='');
  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end, 'Enti che non possono emettere fatture', count(*)::int,
         coalesce(string_agg(r.nome, ', '), 'tutti gli enti sono pronti a fatturare')
    from public.ragioni_sociali r where r.club_id=v_club and coalesce(r.attivo,true)
     and (coalesce(r.iban,'')='' or coalesce(r.indirizzo,'')='' or coalesce(r.cap,'')='' or coalesce(r.citta,'')=''
          or (coalesce(r.soggetto_iva,false) and not public.numero_iva_ben_formato(r.numero_iva, r.paese_iso)));
  return query
  select case when count(*)=0 then 'OK' else 'ATTENZIONE' end, 'Istruttori senza accesso al portale', count(*)::int,
         coalesce(string_agg(i.cognome||' '||i.nome, ', '), 'tutti gli istruttori hanno un accesso')
    from public.istruttori i where i.club_id=v_club and coalesce(i.attivo,true) and i.user_id is null;
  return query
  select case when count(*)=0 then 'OK' else 'ATTENZIONE' end, 'Richieste di iscrizione in attesa', count(*)::int,
         count(*)||' richieste da evadere'
    from public.richieste_iscrizione ri where ri.club_id=v_club and ri.stato='in_attesa';

  return query
  select case when v_mod is null then 'DA SISTEMARE' else 'OK' end,
         'Modalita di gestione del ghiaccio', 0,
         case
           when v_mod = 'griglia_giornaliera' then 'griglia giornaliera: la griglia e l orario vero del club. Chi cambia i corsi deve rifare anche la griglia.'
           when v_mod = 'planning' then 'planning: il planning e l orario vero del club. La griglia segue il planning.'
           when v_mod is null then 'nessuna modalita impostata: il club non sa quale sia il suo orario vero'
           else v_mod end;

  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end,
         'Corsi che non compaiono in griglia', count(*)::int,
         coalesce(string_agg(c.nome||' ('||c.giorno||' '||to_char(c.ora_inizio,'HH24:MI')||')', ', '),
                  'ogni corso attivo ha le sue giornate in griglia')
    from public.corsi c
   where c.club_id=v_club and coalesce(c.attivo,true)
     and not exists (select 1 from public.griglia_blocchi b
                      join public.griglia_sessioni s on s.blocco_id=b.id
                     where b.club_id=v_club and s.corso_id=c.id
                       and b.data between current_date and current_date + 30);

  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end,
         'Griglia con lezioni che non sono piu un corso', count(*)::int,
         coalesce(string_agg(x.titolo||' ('||x.quante||' giornate)', ', '),
                  'ogni giornata in griglia corrisponde a un corso attivo')
    from (select b.titolo, count(*) as quante
            from public.griglia_blocchi b
            left join public.griglia_sessioni s on s.blocco_id=b.id
           where b.club_id=v_club and b.data between current_date and current_date + 30
             and s.id is null
           group by b.titolo) x;

  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end,
         'Giornate di griglia fuori stagione', count(*)::int,
         coalesce(min(b.data)::text||' - '||max(b.data)::text, 'tutta la griglia sta dentro la stagione attiva')
    from public.griglia_blocchi b
   where b.club_id=v_club and v_da is not null
     and (b.data < v_da or b.data > v_al);

  return query
  select case when count(*)=0 then 'OK' else 'DA SISTEMARE' end,
         'Turni fuori dalla disponibilita dell istruttore', count(*)::int,
         coalesce(string_agg(distinct x.chi, ', '),
                  'ogni turno cade dentro una fascia dichiarata')
    from (select i.cognome||' '||i.nome||' ('||c.giorno||' '||to_char(c.ora_inizio,'HH24:MI')||')' as chi
            from public.corsi c
            join public.corsi_istruttori ci on ci.corso_id=c.id
            join public.istruttori i on i.id=ci.istruttore_id
           where c.club_id=v_club and coalesce(c.attivo,true) and c.giorno is not null
             and not exists (select 1 from public.disponibilita_istruttori d
                              where d.istruttore_id=ci.istruttore_id and d.giorno=c.giorno
                                and c.ora_inizio >= d.ora_inizio and c.ora_fine <= d.ora_fine)) x;

  return query
  select case when count(*)=0 then 'OK' else 'ATTENZIONE' end,
         'Lezioni in griglia senza istruttore', count(*)::int,
         coalesce(string_agg(distinct b.titolo, ', '), 'ogni lezione in griglia ha un istruttore')
    from public.griglia_sessioni s
    join public.griglia_blocchi b on b.id=s.blocco_id
   where b.club_id=v_club and b.data between current_date and current_date + 30
     and not exists (select 1 from public.griglia_sessioni_istruttori gi where gi.sessione_id=s.id);
end $function$;