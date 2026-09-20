CREATE OR REPLACE FUNCTION public.finestre_private_disponibili(
  p_club uuid,
  p_istruttore uuid,
  p_da date,
  p_a date,
  p_min_minuti integer DEFAULT 30
)
RETURNS TABLE(data date, risorsa_id uuid, risorsa_nome text, risorsa_tipo text, dalle time without time zone, alle time without time zone, minuti integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with ctx as (
    select p_club as club,
           (p_club = user_club_id() or user_is_admin_like()) as consentito,
           (select s.id from stagioni s where s.club_id = p_club and coalesce(s.attiva,false) limit 1) as stagione
  ),
  giorni as (
    select g.d::date as data,
           lower(translate((array['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'])[extract(dow from g.d)::int + 1], 'ìàèéù', 'iaeeu')) as giorno_norm
      from ctx, generate_series(p_da, p_a, interval '1 day') g(d)
     where ctx.consentito
       and ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt','segreteria','istruttore'])
  ),
  fasce as (
    select gi.data, r.id as risorsa_id, r.nome as risorsa_nome, r.tipo as risorsa_tipo,
           d.ora_inizio, d.ora_fine
      from ctx
      join disponibilita_ghiaccio d on d.club_id = ctx.club
       and coalesce(d.tipo,'') <> 'pulizia'
       and (d.stagione_id is null or d.stagione_id = ctx.stagione)
      join risorse_strutture r on r.id = d.risorsa_id and r.club_id = ctx.club
      join giorni gi on gi.giorno_norm = lower(translate(d.giorno, 'ìàèéù', 'iaeeu'))
  ),
  disp_istr as (
    select gi.data, di.ora_inizio, di.ora_fine
      from ctx
      join istruttori i on i.id = p_istruttore and i.club_id = ctx.club
      join disponibilita_istruttori di on di.istruttore_id = i.id
      join giorni gi on gi.giorno_norm = lower(translate(di.giorno, 'ìàèéù', 'iaeeu'))
  ),
  base as (
    select f.data, f.risorsa_id, f.risorsa_nome, f.risorsa_tipo,
           greatest(f.ora_inizio, d.ora_inizio) as ora_inizio,
           least(f.ora_fine, d.ora_fine) as ora_fine
      from fasce f
      join disp_istr d on d.data = f.data
     where greatest(f.ora_inizio, d.ora_inizio) < least(f.ora_fine, d.ora_fine)
  ),
  occupati as (
    -- rifacimento del ghiaccio
    select gi.data, r.id as risorsa_id, d.ora_inizio, d.ora_fine
      from ctx
      join disponibilita_ghiaccio d on d.club_id = ctx.club and d.tipo = 'pulizia'
       and (d.stagione_id is null or d.stagione_id = ctx.stagione)
      join risorse_strutture r on r.id = d.risorsa_id and r.club_id = ctx.club
      join giorni gi on gi.giorno_norm = lower(translate(d.giorno, 'ìàèéù', 'iaeeu'))
    union all
    -- pacchetti e corsi programmati: blocchi della griglia sulla risorsa
    select b.data, b.risorsa_id, b.ora_inizio, b.ora_fine
      from ctx
      join griglia_blocchi b on b.club_id = ctx.club and b.risorsa_id is not null
       and b.data between p_da and p_a
    union all
    -- lezioni private dell'istruttore (occupano ogni risorsa)
    select lp.data, r.id, lp.ora_inizio, lp.ora_fine
      from ctx
      join lezioni_private lp on lp.club_id = ctx.club and lp.istruttore_id = p_istruttore
       and coalesce(lp.annullata,false) = false and lp.data between p_da and p_a
      join risorse_strutture r on r.club_id = ctx.club
  ),
  bordi as (
    select b.data, b.risorsa_id, b.ora_inizio as t from base b
    union
    select b.data, b.risorsa_id, b.ora_fine from base b
    union
    select o.data, o.risorsa_id, o.ora_inizio from occupati o
     where exists (select 1 from base b where b.data = o.data and b.risorsa_id = o.risorsa_id)
    union
    select o.data, o.risorsa_id, o.ora_fine from occupati o
     where exists (select 1 from base b where b.data = o.data and b.risorsa_id = o.risorsa_id)
  ),
  segmenti as (
    select x.data, x.risorsa_id, x.t as dalle,
           lead(x.t) over (partition by x.data, x.risorsa_id order by x.t) as alle
      from bordi x
  ),
  liberi as (
    select s.data, s.risorsa_id, s.dalle, s.alle
      from segmenti s
     where s.alle is not null
       and exists (select 1 from base b
                    where b.data = s.data and b.risorsa_id = s.risorsa_id
                      and b.ora_inizio <= s.dalle and b.ora_fine >= s.alle)
       and not exists (select 1 from occupati o
                    where o.data = s.data and o.risorsa_id = s.risorsa_id
                      and o.ora_inizio < s.alle and o.ora_fine > s.dalle)
  ),
  numerati as (
    select l.*,
           case when lag(l.alle) over (partition by l.data, l.risorsa_id order by l.dalle) = l.dalle then 0 else 1 end as nuovo
      from liberi l
  ),
  gruppi as (
    select n.*, sum(n.nuovo) over (partition by n.data, n.risorsa_id order by n.dalle rows unbounded preceding) as g
      from numerati n
  ),
  uniti as (
    select g.data, g.risorsa_id, min(g.dalle) as dalle, max(g.alle) as alle
      from gruppi g
     group by g.data, g.risorsa_id, g.g
  )
  select u.data, u.risorsa_id, r.nome, r.tipo, u.dalle, u.alle,
         (extract(epoch from (u.alle - u.dalle))/60)::int as minuti
    from uniti u
    join risorse_strutture r on r.id = u.risorsa_id
   where (extract(epoch from (u.alle - u.dalle))/60)::int >= p_min_minuti
   order by u.data, r.nome, u.dalle;
$function$;

COMMENT ON FUNCTION public.finestre_private_disponibili(uuid, uuid, date, date, integer) IS
'Finestre realmente disponibili per una lezione privata, per risorsa e per data.
Regola dei sei passi: (1) si parte dalle fasce di ghiaccio o palestra dichiarate dal club per quella risorsa (tipo della risorsa letto da risorse_strutture.tipo; fasce senza risorsa ignorate); (2) si tolgono le fasce di rifacimento del ghiaccio (tipo = pulizia); (3) si interseca con la disponibilità dichiarata dell''istruttore per quel giorno della settimana; (4) si tolgono i blocchi della griglia su quella risorsa in quella data (pacchetti e corsi programmati); (5) si tolgono le lezioni private non annullate dell''istruttore; (6) resta disponibile solo ciò che dura almeno p_min_minuti.
Risponde solo per il club di chi chiama (o superadmin). Le fasce sono filtrate sulla stagione attiva del club oppure senza stagione.';