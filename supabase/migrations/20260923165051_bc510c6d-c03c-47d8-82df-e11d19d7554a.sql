CREATE OR REPLACE FUNCTION public.approva_domanda_iscrizione(p_domanda uuid, p_livello text DEFAULT NULL::text, p_categoria text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS TABLE(atleta_id uuid, codice_atleta text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d RECORD; v_id uuid; v_cod text; v_stag uuid; v_liv text; v_cat text;
BEGIN
  SELECT * INTO d FROM public.domande_iscrizione WHERE id = p_domanda;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domanda inesistente'; END IF;

  IF NOT (public.user_is_admin_like()
          OR (d.club_id = public.user_club_id() AND public.puo_gestire_sportivo())) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE = '42501';
  END IF;

  IF d.stato <> 'in_attesa' THEN
    RAISE EXCEPTION 'Questa domanda e'' gia'' stata %', d.stato;
  END IF;

  IF COALESCE(btrim(COALESCE(p_livello, d.livello_assegnato, '')), '') = '' THEN
    RAISE EXCEPTION 'Assegna un livello prima di approvare';
  END IF;

  v_liv := btrim(COALESCE(p_livello, d.livello_assegnato));
  v_cat := COALESCE(p_categoria, 'amatori');

  v_stag := COALESCE(d.stagione_id,
                     (SELECT id FROM public.stagioni
                       WHERE club_id = d.club_id AND attiva ORDER BY data_inizio DESC LIMIT 1));

  -- Il livello va nel campo della categoria (modello nuovo); livello_attuale
  -- resta solo per compatibilita' con la visualizzazione.
  INSERT INTO public.atleti (
    club_id, nome, cognome, data_nascita, sesso,
    genitore1_nome, genitore1_cognome, genitore1_email, genitore1_telefono,
    genitore1_indirizzo, genitore1_cap, genitore1_citta, genitore1_cantone, genitore1_paese_iso,
    indirizzo, cap, citta, cantone, paese_iso,
    livello_attuale, livello_amatori, livello_artistica,
    livello_dichiarato, categoria, club_provenienza,
    consenso_foto_video, partecipa_gare, intende_test_livello,
    contratto_accettato_at, attivo, atleta_club, atleta_esterno,
    verificato, verificato_da_user_id, verificato_at)
  VALUES (
    d.club_id, btrim(d.nome), btrim(d.cognome), d.data_nascita, d.sesso,
    d.genitore1_nome, d.genitore1_cognome, d.genitore1_email, d.genitore1_telefono,
    d.genitore1_indirizzo, d.genitore1_cap, d.genitore1_citta, d.genitore1_cantone,
    COALESCE(d.genitore1_paese_iso,'CH'),
    d.genitore1_indirizzo, d.genitore1_cap, d.genitore1_citta, d.genitore1_cantone,
    COALESCE(d.genitore1_paese_iso,'CH'),
    v_liv,
    CASE WHEN v_cat = 'amatori' THEN v_liv END,
    CASE WHEN v_cat = 'artistica' THEN v_liv END,
    d.livello_dichiarato, v_cat,
    NULLIF(btrim(COALESCE(d.club_provenienza,'')), ''),
    COALESCE(d.consenso_foto_video,false), COALESCE(d.partecipa_gare,false),
    COALESCE(d.intende_test_livello,false),
    d.contratto_accettato_at, true, true, false,
    true, auth.uid(), now())
  RETURNING id, atleti.codice_atleta INTO v_id, v_cod;

  IF d.contratto_testo IS NOT NULL AND d.contratto_accettato_at IS NOT NULL THEN
    INSERT INTO public.contratti_accettati
      (club_id, atleta_id, stagione_id, testo, accettato_il, accettato_da, origine)
    VALUES (d.club_id, v_id, v_stag, d.contratto_testo, d.contratto_accettato_at,
            btrim(COALESCE(d.genitore1_nome,'') || ' ' || COALESCE(d.genitore1_cognome,'')),
            'domanda_iscrizione');
  END IF;

  IF v_stag IS NOT NULL THEN
    PERFORM public.conferma_rinnovo(v_id, v_stag, 'segreteria');
  END IF;

  UPDATE public.domande_iscrizione
     SET stato = 'approvata', atleta_id = v_id,
         livello_assegnato = COALESCE(p_livello, livello_assegnato),
         note_risposta = p_note, gestita_da = auth.uid(), gestita_il = now()
   WHERE id = p_domanda;

  atleta_id := v_id; codice_atleta := v_cod; RETURN NEXT;
END $function$;