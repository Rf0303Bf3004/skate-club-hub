DROP FUNCTION IF EXISTS public.pista_sessioni(date, uuid);

CREATE OR REPLACE FUNCTION public.pista_sessioni(p_data date DEFAULT NULL::date, p_club_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sessione_id uuid, titolo text, ora_inizio time without time zone, ora_fine time without time zone, specialita text, istruttori text, istruttori_ids uuid[], n_atleti integer, in_corso boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ctx as (
    select coalesce(p_data, (now() at time zone 'Europe/Zurich')::date) as d,
           (now() at time zone 'Europe/Zurich')::time as ora,
           case when user_is_admin_like() then coalesce(p_club_id, user_club_id())
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
     and ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','istruttore','aiuto_monitore'])
   order by 3, 2;
$function$;