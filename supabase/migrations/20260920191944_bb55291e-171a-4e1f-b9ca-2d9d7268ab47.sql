CREATE OR REPLACE FUNCTION public.genera_settimana_planning(p_settimana_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Come prima: settimana senza stagione -> non si scrive niente
  IF v_stagione_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH inseriti AS (
    INSERT INTO public.planning_corsi_settimana
      (settimana_id, corso_id, data, ora_inizio, ora_fine, istruttore_id, annullato, is_evento_extra)
    SELECT
      p_settimana_id,
      s.corso_id,
      b.data,
      s.ora_inizio,
      s.ora_fine,
      (SELECT si.istruttore_id
         FROM public.griglia_sessioni_istruttori si
        WHERE si.sessione_id = s.id
        ORDER BY si.created_at ASC
        LIMIT 1),
      false,
      false
    FROM public.griglia_blocchi b
    JOIN public.griglia_sessioni s ON s.blocco_id = b.id
    WHERE b.club_id = v_club_id
      AND b.data >= v_data_lunedi
      AND b.data <= v_data_lunedi + 6
      AND s.corso_id IS NOT NULL
      -- evita duplicati: salta i corsi gia' presenti per questa settimana (qualsiasi stato)
      AND NOT EXISTS (
        SELECT 1 FROM public.planning_corsi_settimana p
        WHERE p.settimana_id = p_settimana_id
          AND p.corso_id = s.corso_id
      )
    ON CONFLICT (settimana_id, corso_id) WHERE annullato = false AND is_evento_extra = false
    DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inseriti FROM inseriti;

  RETURN COALESCE(v_inseriti, 0);
END;
$function$;

COMMENT ON FUNCTION public.genera_settimana_planning(uuid) IS
'Riempie planning_corsi_settimana per la settimana indicata. La sorgente e'' la GRIGLIA (griglia_blocchi + griglia_sessioni con corso_id), non il modello settimanale dei corsi: la griglia e'' lo strumento con cui il club costruisce l''attivita'', e il planning deve rispecchiarla. Per ogni sessione scrive data del blocco, orari della sessione e il primo istruttore assegnato (nullo se nessuno). Settimana senza stagione: restituisce 0 senza scrivere. Protezione doppioni: salta i corsi gia'' presenti nella settimana e ON CONFLICT DO NOTHING sull''indice (settimana_id, corso_id) per righe non annullate e non extra.';