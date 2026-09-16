-- 1) Codice pista del club -------------------------------------------------
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS codice_pista text;

CREATE OR REPLACE FUNCTION public.genera_codice_pista()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_alen int := length(v_alphabet);
  v_code text; v_attempts int := 0; v_exists boolean; i int;
BEGIN
  LOOP
    v_code := 'PI-';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_alen)::int, 1);
    END LOOP;
    v_code := v_code || '-';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_alen)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.clubs WHERE codice_pista = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_attempts := v_attempts + 1;
    IF v_attempts > 25 THEN
      RAISE EXCEPTION 'genera_codice_pista: impossibile generare codice univoco dopo 25 tentativi';
    END IF;
  END LOOP;
  RETURN v_code;
END $function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.clubs WHERE codice_pista IS NULL LOOP
    UPDATE public.clubs SET codice_pista = public.genera_codice_pista() WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS clubs_codice_pista_key ON public.clubs (codice_pista);

CREATE OR REPLACE FUNCTION public.rigenera_codice_pista(p_club_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_code text;
BEGIN
  IF NOT (
    ruolo_in(array['superadmin'])
    OR EXISTS (
      SELECT 1 FROM public.utenti_club uc
       WHERE uc.user_id = auth.uid()
         AND uc.club_id = p_club_id
         AND coalesce(uc.attivo, true) = true
         AND uc.ruolo IN ('presidente','admin')
    )
  ) THEN
    RAISE EXCEPTION 'Non hai il permesso di rigenerare il codice pista di questo club.' USING errcode = '42501';
  END IF;

  v_code := public.genera_codice_pista();
  UPDATE public.clubs SET codice_pista = v_code WHERE id = p_club_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club non trovato.' USING errcode = 'P0002';
  END IF;
  RETURN v_code;
END $function$;

GRANT EXECUTE ON FUNCTION public.rigenera_codice_pista(uuid) TO authenticated;

-- 2) Riconoscimento della sessione pista ------------------------------------
CREATE OR REPLACE FUNCTION public.is_pista()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'pista', false); $function$;

CREATE OR REPLACE FUNCTION public.pista_club_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select case when coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'pista', false)
              then nullif((auth.jwt() -> 'app_metadata' ->> 'club_id'), '')::uuid
         end;
$function$;

GRANT EXECUTE ON FUNCTION public.is_pista() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pista_club_id() TO authenticated, anon;

-- 3) Funzioni del bordo pista: accettano anche la sessione pista -------------
CREATE OR REPLACE FUNCTION public.pista_sessioni(p_data date DEFAULT NULL::date, p_club_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(sessione_id uuid, titolo text, ora_inizio time without time zone, ora_fine time without time zone, specialita text, istruttori text, istruttori_ids uuid[], n_atleti integer, in_corso boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with ctx as (
    select coalesce(p_data, (now() at time zone 'Europe/Zurich')::date) as d,
           (now() at time zone 'Europe/Zurich')::time as ora,
           case when is_pista() then pista_club_id()
                when user_is_admin_like() then coalesce(p_club_id, user_club_id())
                else user_club_id() end as club
  )
  select s.id,
         coalesce(nullif(b.titolo,''), c.nome, 'Sessione'),
         coalesce(s.ora_inizio, b.ora_inizio),
         coalesce(s.ora_fine, b.ora_fine),
         coalesce(sp.nome, nullif(s.specialita_testo_libero,'')),
         (select string_agg(i.nome || ' ' || i.cognome, ', ' order by i.cognome, i.nome)
            from griglia_sessioni_istruttori gi
            join istruttori i on i.id = gi.istruttore_id
           where gi.sessione_id = s.id),
         coalesce((select array_agg(gi.istruttore_id order by gi.istruttore_id)
            from griglia_sessioni_istruttori gi
           where gi.sessione_id = s.id), '{}'::uuid[]),
         (select count(*)::integer from griglia_sessioni_atleti sa where sa.sessione_id = s.id),
         (ctx.ora >= coalesce(s.ora_inizio, b.ora_inizio) and ctx.ora < coalesce(s.ora_fine, b.ora_fine))
    from ctx
    join griglia_blocchi b on b.data = ctx.d and b.club_id = ctx.club and b.stato = 'pubblicato'
    join griglia_sessioni s on s.blocco_id = b.id
    left join corsi c on c.id = s.corso_id
    left join griglia_specialita sp on sp.id = s.specialita_id
   where ctx.club is not null
     and (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore']))
   order by 3, 2;
$function$;

CREATE OR REPLACE FUNCTION public.pista_sessioni_istruttore(p_istruttore_id uuid, p_data date DEFAULT NULL::date)
RETURNS TABLE(sessione_id uuid, titolo text, ora_inizio time without time zone, ora_fine time without time zone, specialita text, altri_istruttori text, n_atleti integer, in_corso boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with ctx as (
    select coalesce(p_data, (now() at time zone 'Europe/Zurich')::date) as d,
           (now() at time zone 'Europe/Zurich')::time as ora
  )
  select s.id,
         coalesce(nullif(b.titolo,''), c.nome, 'Sessione'),
         coalesce(s.ora_inizio, b.ora_inizio),
         coalesce(s.ora_fine, b.ora_fine),
         coalesce(sp.nome, nullif(s.specialita_testo_libero,'')),
         (select string_agg(i2.nome || ' ' || i2.cognome, ', ' order by i2.cognome, i2.nome)
            from griglia_sessioni_istruttori gi2
            join istruttori i2 on i2.id = gi2.istruttore_id
           where gi2.sessione_id = s.id and gi2.istruttore_id <> p_istruttore_id),
         (select count(*)::integer from griglia_sessioni_atleti sa where sa.sessione_id = s.id),
         (ctx.ora >= coalesce(s.ora_inizio, b.ora_inizio) and ctx.ora < coalesce(s.ora_fine, b.ora_fine))
    from ctx
    join griglia_blocchi b on b.data = ctx.d and b.stato = 'pubblicato'
     and b.club_id = case when is_pista() then pista_club_id()
                          when user_is_admin_like() then b.club_id
                          else user_club_id() end
    join griglia_sessioni s on s.blocco_id = b.id
    join griglia_sessioni_istruttori gi on gi.sessione_id = s.id and gi.istruttore_id = p_istruttore_id
    left join corsi c on c.id = s.corso_id
    left join griglia_specialita sp on sp.id = s.specialita_id
   where (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore']))
   order by 3;
$function$;

CREATE OR REPLACE FUNCTION public.pista_istruttori(p_data date DEFAULT NULL::date, p_club_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(istruttore_id uuid, nome text, cognome text, n_sessioni integer, prima_ora time without time zone, ha_sessione_in_corso boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with ctx as (
    select coalesce(p_data, (now() at time zone 'Europe/Zurich')::date) as d,
           (now() at time zone 'Europe/Zurich')::time as ora,
           case when is_pista() then pista_club_id()
                when user_is_admin_like() then coalesce(p_club_id, user_club_id())
                else user_club_id() end as club
  ),
  righe as (
    select gi.istruttore_id, s.id as sessione_id,
           coalesce(s.ora_inizio, b.ora_inizio) as dalle,
           coalesce(s.ora_fine, b.ora_fine) as alle,
           ctx.ora as adesso
      from ctx
      join griglia_blocchi b on b.data = ctx.d and b.club_id = ctx.club and b.stato = 'pubblicato'
      join griglia_sessioni s on s.blocco_id = b.id
      join griglia_sessioni_istruttori gi on gi.sessione_id = s.id
     where ctx.club is not null
       and (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore']))
  )
  select r.istruttore_id, i.nome, i.cognome,
         count(*)::integer,
         min(r.dalle),
         bool_or(r.adesso >= r.dalle and r.adesso < r.alle)
    from righe r
    join istruttori i on i.id = r.istruttore_id
   group by r.istruttore_id, i.nome, i.cognome
   order by bool_or(r.adesso >= r.dalle and r.adesso < r.alle) desc, min(r.dalle), i.cognome, i.nome;
$function$;

CREATE OR REPLACE FUNCTION public.pista_compleanni(p_data date DEFAULT NULL::date, p_club_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(chi text, nome text, cognome text, anni integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with ctx as (
    select coalesce(p_data, (now() at time zone 'Europe/Zurich')::date) as d,
           case when is_pista() then pista_club_id()
                when user_is_admin_like() then coalesce(p_club_id, user_club_id())
                else user_club_id() end as club
  )
  select 'atleta', a.nome, a.cognome,
         (extract(year from age(ctx.d, a.data_nascita)))::integer
    from ctx join atleti a on a.club_id = ctx.club
   where ctx.club is not null
     and a.data_nascita is not null
     and coalesce(a.attivo, true)
     and to_char(a.data_nascita,'MM-DD') = to_char(ctx.d,'MM-DD')
     and (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore']))
   order by 3, 2;
$function$;

CREATE OR REPLACE FUNCTION public.pista_atleti(p_sessione_id uuid)
RETURNS TABLE(atleta_id uuid, nome text, cognome text, gruppo_sessione_id uuid, etichetta text, stato text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with rif as (select * from pista_riferimento(p_sessione_id))
  select a.id, a.nome, a.cognome, sa.gruppo_sessione_id, sa.etichetta,
         case
           when p.id is null then 'non_registrato'
           when p.metodo in ('assente','giustificata') then 'assente'
           when p.metodo = 'dichiarata_no' then 'avvisato'
           else 'presente'
         end
    from rif
    join griglia_sessioni_atleti sa on sa.sessione_id = p_sessione_id
    join atleti a on a.id = sa.atleta_id
    left join presenze p
      on p.tipo_persona = 'atleta' and p.persona_id = a.id
     and p.tipo_riferimento = rif.tipo and p.riferimento_id = rif.id
   where rif.club_id = case when is_pista() then pista_club_id()
                            when user_is_admin_like() then rif.club_id
                            else user_club_id() end
     and (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore']))
   order by a.cognome, a.nome;
$function$;

CREATE OR REPLACE FUNCTION public.pista_appello(p_sessione_id uuid, p_assenti uuid[] DEFAULT '{}'::uuid[])
RETURNS TABLE(presenti integer, assenti integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_tipo text; v_rif uuid; v_data date; v_club uuid;
  v_ora time := (now() at time zone 'Europe/Zurich')::time;
  v_presenti integer := 0; v_assenti integer := 0;
begin
  if not (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore'])) then
    raise exception 'Non hai il permesso di registrare l''appello.';
  end if;

  select r.tipo, r.id, r.data, r.club_id into v_tipo, v_rif, v_data, v_club
    from pista_riferimento(p_sessione_id) r;

  if v_rif is null then
    raise exception 'Sessione non trovata.';
  end if;

  if is_pista() then
    if v_club is distinct from pista_club_id() then
      raise exception 'Questa sessione non appartiene al tuo club.';
    end if;
  elsif not user_is_admin_like() and v_club is distinct from user_club_id() then
    raise exception 'Questa sessione non appartiene al tuo club.';
  end if;

  delete from presenze p
   where p.tipo_persona = 'atleta'
     and p.tipo_riferimento = v_tipo
     and p.riferimento_id = v_rif
     and p.persona_id in (select sa.atleta_id from griglia_sessioni_atleti sa where sa.sessione_id = p_sessione_id);

  insert into presenze (club_id, persona_id, tipo_persona, data, ora_entrata, metodo, riferimento_id, tipo_riferimento)
  select v_club, sa.atleta_id, 'atleta', v_data,
         case when sa.atleta_id = any(p_assenti) then null else v_ora end,
         case when sa.atleta_id = any(p_assenti) then 'assente' else 'manuale' end,
         v_rif, v_tipo
    from griglia_sessioni_atleti sa
   where sa.sessione_id = p_sessione_id;

  select count(*) filter (where not (sa.atleta_id = any(p_assenti))),
         count(*) filter (where sa.atleta_id = any(p_assenti))
    into v_presenti, v_assenti
    from griglia_sessioni_atleti sa where sa.sessione_id = p_sessione_id;

  return query select v_presenti, v_assenti;
end $function$;

CREATE OR REPLACE FUNCTION public.pista_note(p_sessione_id uuid)
RETURNS TABLE(id uuid, atleta_id uuid, testo text, autore_nome text, creata_il timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select n.id, n.atleta_id, n.testo, n.autore_nome, n.created_at
    from note_pista n
    join griglia_sessioni s on s.id = n.sessione_id
    join griglia_blocchi b on b.id = s.blocco_id
   where n.sessione_id = p_sessione_id
     and (case when is_pista() then b.club_id = pista_club_id()
               else (user_is_admin_like() or b.club_id = user_club_id()) end)
     and (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore']))
   order by n.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.pista_nota_salva(p_sessione_id uuid, p_atleta_id uuid, p_testo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_club uuid;
  v_nome text;
  v_id uuid;
begin
  if not (is_pista() or ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore'])) then
    raise exception 'Non hai il permesso di scrivere note di bordo pista.' using errcode = '42501';
  end if;

  if p_testo is null or length(btrim(p_testo)) = 0 then
    raise exception 'La nota è vuota.' using errcode = '22023';
  end if;

  select b.club_id into v_club
    from griglia_sessioni s join griglia_blocchi b on b.id = s.blocco_id
   where s.id = p_sessione_id;

  if v_club is null then
    raise exception 'Sessione non trovata.' using errcode = 'P0002';
  end if;

  if is_pista() then
    if v_club is distinct from pista_club_id() then
      raise exception 'Sessione di un altro club.' using errcode = '42501';
    end if;
  elsif not user_is_admin_like() and v_club is distinct from user_club_id() then
    raise exception 'Sessione di un altro club.' using errcode = '42501';
  end if;

  if not exists (select 1 from griglia_sessioni_atleti sa
                  where sa.sessione_id = p_sessione_id and sa.atleta_id = p_atleta_id) then
    raise exception 'Questa atleta non è in questa sessione.' using errcode = '23514';
  end if;

  if is_pista() then
    v_nome := 'Bordo pista';
  else
    select trim(both ' ' from coalesce(uc.nome,'') || ' ' || coalesce(uc.cognome,'')) into v_nome
      from utenti_club uc
     where uc.user_id = auth.uid() and uc.club_id = v_club
     limit 1;
  end if;

  insert into note_pista (club_id, sessione_id, atleta_id, testo, autore_user_id, autore_nome)
  values (v_club, p_sessione_id, p_atleta_id, btrim(p_testo), auth.uid(), nullif(v_nome,''))
  returning id into v_id;

  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.pista_nota_elimina(p_nota_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_autore uuid; v_club uuid;
begin
  select autore_user_id, club_id into v_autore, v_club from note_pista where id = p_nota_id;
  if v_club is null then return; end if;

  if is_pista() then
    if v_club is distinct from pista_club_id() then
      raise exception 'Nota di un altro club.' using errcode = '42501';
    end if;
    if v_autore is distinct from auth.uid() then
      raise exception 'Puoi cancellare solo le note che hai scritto tu.' using errcode = '42501';
    end if;
    delete from note_pista where id = p_nota_id;
    return;
  end if;

  if not user_is_admin_like() and v_club is distinct from user_club_id() then
    raise exception 'Nota di un altro club.' using errcode = '42501';
  end if;
  if v_autore is distinct from auth.uid()
     and not ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt']) then
    raise exception 'Puoi cancellare solo le note che hai scritto tu.' using errcode = '42501';
  end if;
  delete from note_pista where id = p_nota_id;
end $function$;