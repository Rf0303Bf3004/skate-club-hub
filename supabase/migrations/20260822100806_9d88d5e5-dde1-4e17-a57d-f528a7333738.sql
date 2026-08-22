CREATE OR REPLACE FUNCTION public.genera_planning_giornaliero()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_club RECORD;
  v_data_target date;
  v_hour_zh int;
  v_today_zh date;
  v_row RECORD;
  v_com_id uuid;
  v_total int := 0;
BEGIN
  v_hour_zh := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Zurich'))::int;
  v_today_zh := (now() AT TIME ZONE 'Europe/Zurich')::date;

  FOR v_club IN
    SELECT id, reminder_planning_atleti_attivo, reminder_planning_istruttori_attivo,
           reminder_planning_anticipo_giorni
      FROM public.clubs
     WHERE reminder_planning_orario_invio = v_hour_zh
       AND (reminder_planning_last_run_date IS NULL OR reminder_planning_last_run_date < v_today_zh)
       AND (reminder_planning_atleti_attivo OR reminder_planning_istruttori_attivo)
  LOOP
    v_data_target := v_today_zh + COALESCE(v_club.reminder_planning_anticipo_giorni, 0);

    IF v_club.reminder_planning_atleti_attivo THEN
      FOR v_row IN
        WITH sess AS (
          SELECT gs.id AS sessione_id, gs.ora_inizio, gs.ora_fine,
                 COALESCE(sp.nome, gs.specialita_testo_libero, 'Sessione') AS titolo_sessione,
                 rs.nome AS risorsa_nome,
                 (SELECT string_agg(i.nome || ' ' || COALESCE(i.cognome, ''), ', ' ORDER BY i.nome)
                    FROM public.griglia_sessioni_istruttori gsi
                    JOIN public.istruttori i ON i.id = gsi.istruttore_id
                   WHERE gsi.sessione_id = gs.id) AS istruttori
            FROM public.griglia_sessioni gs
            JOIN public.griglia_blocchi gb ON gb.id = gs.blocco_id
            LEFT JOIN public.griglia_specialita sp ON sp.id = gs.specialita_id
            LEFT JOIN public.risorse_strutture rs ON rs.id = gb.risorsa_id
           WHERE gb.club_id = v_club.id AND gb.data = v_data_target
        )
        SELECT gsa.atleta_id,
               string_agg(
                 to_char(s.ora_inizio, 'HH24:MI') || '–' || to_char(s.ora_fine, 'HH24:MI')
                 || ' ' || s.titolo_sessione
                 || COALESCE(' (' || s.risorsa_nome || ')', '')
                 || COALESCE(' con ' || s.istruttori, ''),
                 '; ' ORDER BY s.ora_inizio
               ) AS programma
          FROM public.griglia_sessioni_atleti gsa
          JOIN sess s ON s.sessione_id = gsa.sessione_id
          JOIN public.atleti a ON a.id = gsa.atleta_id
         GROUP BY gsa.atleta_id
      LOOP
        v_com_id := NULL;
        INSERT INTO public.comunicazioni
          (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
           atleta_id, data_evento, richiede_rsvp, tipo_destinatari)
        VALUES
          (v_club.id,
           'Programma del ' || to_char(v_data_target, 'DD/MM'),
           '📅 Il tuo programma di ' || to_char(v_data_target, 'DD/MM/YYYY') || ': ' || v_row.programma,
           'reminder', 'planning_giornaliero', 'inviata', 'sent',
           v_row.atleta_id, v_data_target, false, 'atleti')
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_com_id;

        IF v_com_id IS NOT NULL THEN
          INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id, stato)
          VALUES (v_com_id, v_row.atleta_id, 'pending')
          ON CONFLICT DO NOTHING;
          v_total := v_total + 1;
        END IF;
      END LOOP;
    END IF;

    IF v_club.reminder_planning_istruttori_attivo THEN
      FOR v_row IN
        WITH sess AS (
          SELECT gs.id AS sessione_id, gs.ora_inizio, gs.ora_fine,
                 COALESCE(sp.nome, gs.specialita_testo_libero, 'Sessione') AS titolo_sessione,
                 rs.nome AS risorsa_nome
            FROM public.griglia_sessioni gs
            JOIN public.griglia_blocchi gb ON gb.id = gs.blocco_id
            LEFT JOIN public.griglia_specialita sp ON sp.id = gs.specialita_id
            LEFT JOIN public.risorse_strutture rs ON rs.id = gb.risorsa_id
           WHERE gb.club_id = v_club.id AND gb.data = v_data_target
        )
        SELECT i.user_id,
               string_agg(
                 to_char(s.ora_inizio, 'HH24:MI') || '–' || to_char(s.ora_fine, 'HH24:MI')
                 || ' ' || s.titolo_sessione
                 || COALESCE(' (' || s.risorsa_nome || ')', ''),
                 '; ' ORDER BY s.ora_inizio
               ) AS programma
          FROM public.griglia_sessioni_istruttori gsi
          JOIN sess s ON s.sessione_id = gsi.sessione_id
          JOIN public.istruttori i ON i.id = gsi.istruttore_id
         WHERE i.user_id IS NOT NULL
         GROUP BY i.user_id
      LOOP
        v_com_id := NULL;
        INSERT INTO public.comunicazioni
          (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
           data_evento, richiede_rsvp, tipo_destinatari, urgente)
        VALUES
          (v_club.id,
           'STAFF — Programma del ' || to_char(v_data_target, 'DD/MM'),
           '📅 Il tuo programma di ' || to_char(v_data_target, 'DD/MM/YYYY') || ': ' || v_row.programma,
           'reminder', 'planning_giornaliero', 'inviata', 'sent',
           v_data_target, false, 'staff', false)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_com_id;

        IF v_com_id IS NOT NULL THEN
          INSERT INTO public.comunicazioni_destinatari_staff (comunicazione_id, user_id, club_id, stato)
          VALUES (v_com_id, v_row.user_id, v_club.id, 'pending')
          ON CONFLICT DO NOTHING;
          v_total := v_total + 1;
        END IF;
      END LOOP;
    END IF;

    UPDATE public.clubs SET reminder_planning_last_run_date = v_today_zh WHERE id = v_club.id;
  END LOOP;

  RETURN v_total;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.genera_planning_giornaliero() FROM PUBLIC, anon, authenticated;