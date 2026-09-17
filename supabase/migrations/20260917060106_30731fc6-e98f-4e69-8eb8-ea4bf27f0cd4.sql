CREATE OR REPLACE FUNCTION public.valuta_iscrizione(p_atleta_id uuid, p_corso_id uuid)
RETURNS TABLE(conforme boolean, motivo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_liv_corso  text;
  v_nome_corso text;
  v_liv_atleta text;
  v_atleta     text;
begin
  select c.livello_richiesto, c.nome into v_liv_corso, v_nome_corso
    from public.corsi c where c.id = p_corso_id;

  if v_liv_corso is null then
    return query select true, ''::text;
    return;
  end if;

  select a.livello_attuale, a.cognome||' '||a.nome into v_liv_atleta, v_atleta
    from public.atleti a where a.id = p_atleta_id;

  if v_liv_corso is not distinct from v_liv_atleta then
    return query select true, ''::text;
    return;
  end if;

  return query select false, format(
    '%s e al livello %s e il corso "%s" chiede il livello %s. Se l''iscrizione e voluta lo stesso, indica il motivo dell''eccezione e procedi.',
    coalesce(v_atleta,'L''atleta'),
    coalesce(v_liv_atleta,'non indicato'),
    coalesce(v_nome_corso,'scelto'),
    v_liv_corso);
end $function$;

REVOKE EXECUTE ON FUNCTION public.valuta_iscrizione(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valuta_iscrizione(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.iscrizioni_corsi_valida_livello()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_controlla boolean := true;
  v_conforme  boolean;
  v_motivo    text;
begin
  -- Le righe gia presenti non vengono toccate: in aggiornamento si controlla
  -- solo se cambia il corso, cambia l'atleta o l'iscrizione viene riattivata.
  if TG_OP = 'UPDATE' then
    v_controlla := NEW.corso_id is distinct from OLD.corso_id
                or NEW.atleta_id is distinct from OLD.atleta_id
                or (coalesce(NEW.attiva,true) and not coalesce(OLD.attiva,true));
  end if;

  if v_controlla then
    select v.conforme, v.motivo into v_conforme, v_motivo
      from public.valuta_iscrizione(NEW.atleta_id, NEW.corso_id) v;

    if not coalesce(v_conforme, true) then
      if not coalesce(NEW.forzata,false)
         or coalesce(btrim(NEW.motivo_forzatura),'') = '' then
        raise exception '%', v_motivo;
      end if;
    end if;
  end if;

  if coalesce(NEW.forzata,false) then
    if NEW.forzato_da is null then NEW.forzato_da := auth.uid(); end if;
    if NEW.forzato_at is null then NEW.forzato_at := now(); end if;
  end if;

  return NEW;
end $function$;

CREATE OR REPLACE FUNCTION public.referto_iscrizioni(p_club_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(atleta text, livello_atleta text, corso text, livello_richiesto text, esito text, motivo text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with righe as (
    select a.cognome||' '||a.nome as atleta,
           a.livello_attuale      as livello_atleta,
           c.nome                 as corso,
           c.livello_richiesto    as livello_richiesto,
           (coalesce(ic.forzata,false) and coalesce(btrim(ic.motivo_forzatura),'') <> '') as dichiarata,
           v.conforme, v.motivo
      from public.iscrizioni_corsi ic
      join public.atleti a on a.id = ic.atleta_id
      join public.corsi  c on c.id = ic.corso_id
      cross join lateral public.valuta_iscrizione(ic.atleta_id, ic.corso_id) v
     where a.club_id = coalesce(p_club_id, public.user_club_id())
       and coalesce(ic.attiva,true)
  )
  select atleta, livello_atleta, corso, livello_richiesto,
         case when conforme then 'conforme'
              when dichiarata then 'eccezione dichiarata'
              else 'sarebbe rifiutata' end as esito,
         case when conforme then '' else motivo end as motivo
    from righe
   order by case when conforme then 2 when dichiarata then 1 else 0 end, atleta, corso;
$function$;

REVOKE EXECUTE ON FUNCTION public.referto_iscrizioni(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referto_iscrizioni(uuid) TO authenticated, service_role;

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

  -- Stessa regola del trigger: public.valuta_iscrizione.
  -- Le eccezioni dichiarate (forzata + motivo) non sono un difetto: si citano, non si contano.
  return query
  with base as (
    select a.cognome||' '||a.nome||' ('||coalesce(a.livello_attuale,'livello non indicato')||' in '||c.nome||')' as chi,
           (coalesce(ic.forzata,false) and coalesce(btrim(ic.motivo_forzatura),'') <> '') as dichiarata
      from public.iscrizioni_corsi ic
      join public.atleti a on a.id=ic.atleta_id
      join public.corsi  c on c.id=ic.corso_id
      cross join lateral public.valuta_iscrizione(ic.atleta_id, ic.corso_id) v
     where a.club_id=v_club and coalesce(ic.attiva,true) and coalesce(a.attivo,true)
       and not v.conforme
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