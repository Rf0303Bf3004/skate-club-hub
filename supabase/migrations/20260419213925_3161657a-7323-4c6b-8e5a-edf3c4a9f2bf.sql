-- Indice unique parziale: 1 occorrenza per (settimana, corso) escludendo annullamenti ed eventi extra
CREATE UNIQUE INDEX IF NOT EXISTS idx_planning_corso_settimana_unique
  ON public.planning_corsi_settimana(settimana_id, corso_id)
  WHERE annullato = false AND is_evento_extra = false;

-- Funzione: genera occorrenze planning di una settimana copiando dai corsi master
CREATE OR REPLACE FUNCTION public.genera_settimana_planning(p_settimana_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_lunedi date;
  v_club_id uuid;
  v_stagione_id uuid;
  v_inseriti integer := 0;
BEGIN
  SELECT data_lunedi, club_id, stagione_id
    INTO v_data_lunedi, v_club_id, v_stagione_id
  FROM public.planning_settimane
  WHERE id = p_settimana_id;

  IF v_data_lunedi IS NULL THEN
    RAISE EXCEPTION 'Settimana % non trovata', p_settimana_id;
  END IF;

  -- Richiediamo che la settimana abbia una stagione (i corsi senza stagione vengono ignorati)
  IF v_stagione_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH inseriti AS (
    INSERT INTO public.planning_corsi_settimana
      (settimana_id, corso_id, data, ora_inizio, ora_fine, istruttore_id, annullato, is_evento_extra)
    SELECT
      p_settimana_id,
      c.id,
      v_data_lunedi + (CASE c.giorno
        WHEN 'Lunedì'    THEN 0
        WHEN 'Martedì'   THEN 1
        WHEN 'Mercoledì' THEN 2
        WHEN 'Giovedì'   THEN 3
        WHEN 'Venerdì'   THEN 4
        WHEN 'Sabato'    THEN 5
        WHEN 'Domenica'  THEN 6
        ELSE NULL
      END)::int,
      c.ora_inizio,
      c.ora_fine,
      (SELECT ci.istruttore_id
         FROM public.corsi_istruttori ci
        WHERE ci.corso_id = c.id
        ORDER BY ci.created_at ASC
        LIMIT 1),
      false,
      false
    FROM public.corsi c
    WHERE c.club_id = v_club_id
      AND c.stagione_id = v_stagione_id
      AND COALESCE(c.attivo, true) = true
      AND c.giorno IN ('Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica')
      -- evita duplicati: salta corsi già presenti per questa settimana (qualsiasi stato)
      AND NOT EXISTS (
        SELECT 1 FROM public.planning_corsi_settimana p
        WHERE p.settimana_id = p_settimana_id
          AND p.corso_id = c.id
      )
    ON CONFLICT (settimana_id, corso_id) WHERE annullato = false AND is_evento_extra = false
    DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inseriti FROM inseriti;

  RETURN COALESCE(v_inseriti, 0);
END;
$$;