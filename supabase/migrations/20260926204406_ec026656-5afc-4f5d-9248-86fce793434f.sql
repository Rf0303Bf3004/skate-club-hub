CREATE OR REPLACE FUNCTION public.corsi_per_atleta(p_atleta_id uuid)
 RETURNS TABLE(id uuid, club_id uuid, nome text, tipo text, giorno text, ora_inizio time without time zone, ora_fine time without time zone, costo_mensile numeric, costo_annuale numeric, attivo boolean, livello_richiesto text, percorso text, richiede_approvazione boolean, iscritto boolean, richiesta_in_attesa boolean, salto_livello boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH atleta AS (
    SELECT id, club_id, livello_amatori, livello_artistica, livello_stile,
           CASE WHEN COALESCE(livello_amatori, livello_artistica, livello_stile) IS NULL
                THEN livello_attuale END AS ripiego
    FROM atleti WHERE id = p_atleta_id
  ),
  iscrizioni_attive AS (
    SELECT corso_id, salto_livello FROM iscrizioni_corsi
    WHERE atleta_id = p_atleta_id AND attiva = true
  ),
  richieste_pending AS (
    SELECT corso_id FROM richieste_iscrizione
    WHERE atleta_id = p_atleta_id AND stato = 'in_attesa'
  )
  SELECT
    c.id, c.club_id, c.nome, c.tipo, c.giorno, c.ora_inizio, c.ora_fine,
    c.costo_mensile, c.costo_annuale, c.attivo, c.livello_richiesto, c.percorso,
    c.richiede_approvazione,
    (ia.corso_id IS NOT NULL) AS iscritto,
    (rp.corso_id IS NOT NULL) AS richiesta_in_attesa,
    COALESCE(ia.salto_livello, false) AS salto_livello
  FROM corsi c
  JOIN atleta a ON a.club_id = c.club_id
  LEFT JOIN iscrizioni_attive ia ON ia.corso_id = c.id
  LEFT JOIN richieste_pending rp ON rp.corso_id = c.id
  WHERE c.attivo = true
    AND (
      c.livello_richiesto IS NULL
      OR lower(btrim(c.livello_richiesto)) IN ('tutti', 'tutti i livelli')
      OR (c.percorso IS NULL AND EXISTS (
            SELECT 1 FROM unnest(string_to_array(c.livello_richiesto, ',')) AS v(liv)
            WHERE btrim(v.liv) IN (a.livello_amatori, a.livello_artistica, a.ripiego)))
      OR (c.percorso = 'artistica' AND EXISTS (
            SELECT 1 FROM unnest(string_to_array(c.livello_richiesto, ',')) AS v(liv)
            WHERE btrim(v.liv) = a.livello_artistica))
      OR (c.percorso = 'stile' AND EXISTS (
            SELECT 1 FROM unnest(string_to_array(c.livello_richiesto, ',')) AS v(liv)
            WHERE btrim(v.liv) = a.livello_stile))
      OR ia.corso_id IS NOT NULL
      OR rp.corso_id IS NOT NULL
    )
  ORDER BY c.giorno, c.ora_inizio;
$function$;