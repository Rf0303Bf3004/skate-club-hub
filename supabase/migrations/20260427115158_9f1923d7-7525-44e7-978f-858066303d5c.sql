CREATE OR REPLACE FUNCTION public.corsi_per_atleta(p_atleta_id uuid)
RETURNS TABLE (
  id uuid,
  club_id uuid,
  nome text,
  tipo text,
  giorno text,
  ora_inizio time without time zone,
  ora_fine time without time zone,
  livello_richiesto text,
  costo_mensile numeric,
  costo_annuale numeric,
  categoria text,
  stagione_id uuid,
  attivo boolean,
  usa_ghiaccio boolean,
  note text,
  created_at timestamp with time zone,
  iscrizione_requires_approval boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Recupera club_id e livello dell'atleta
  WITH atleta_info AS (
    SELECT a.club_id, a.livello_attuale
    FROM public.atleti a
    WHERE a.id = p_atleta_id
  )
  -- Ritorna tutti i corsi attivi del club
  SELECT 
    c.id,
    c.club_id,
    c.nome,
    c.tipo,
    c.giorno,
    c.ora_inizio,
    c.ora_fine,
    c.livello_richiesto,
    c.costo_mensile,
    c.costo_annuale,
    c.categoria,
    c.stagione_id,
    c.attivo,
    c.usa_ghiaccio,
    c.note,
    c.created_at,
    false AS iscrizione_requires_approval
  FROM public.corsi c
  JOIN atleta_info ai ON c.club_id = ai.club_id
  WHERE COALESCE(c.attivo, true) = true;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.corsi_per_atleta(uuid) TO authenticated;

-- Also grant to anon if needed for mobile app
GRANT EXECUTE ON FUNCTION public.corsi_per_atleta(uuid) TO anon;