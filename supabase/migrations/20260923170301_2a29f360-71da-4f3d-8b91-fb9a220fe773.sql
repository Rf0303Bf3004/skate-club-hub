-- lovable-cron-fallback-reviewed: riprova ogni 5 min armata solo con mail in coda, si disarma a coda vuota
ALTER TABLE public.domande_iscrizione
  ADD COLUMN IF NOT EXISTS mail_benvenuto_stato text
    CHECK (mail_benvenuto_stato IN ('da_inviare','inviata','senza_indirizzo','fallita')),
  ADD COLUMN IF NOT EXISTS mail_benvenuto_motivo text,
  ADD COLUMN IF NOT EXISTS mail_benvenuto_tentativi integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mail_benvenuto_ultimo_tentativo timestamptz,
  ADD COLUMN IF NOT EXISTS mail_benvenuto_inviata_at timestamptz;

CREATE INDEX IF NOT EXISTS domande_iscrizione_mail_da_inviare_idx
  ON public.domande_iscrizione (mail_benvenuto_ultimo_tentativo)
  WHERE mail_benvenuto_stato = 'da_inviare';

-- Sveglia la funzione di invio (parte dopo il commit della transazione).
CREATE OR REPLACE FUNCTION public.sveglia_coda_benvenuto()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://mdlfhdyyzrxppamlzepd.supabase.co/functions/v1/invia-email-iscrizioni',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbGZoZHl5enJ4cHBhbWx6ZXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTY1MTMsImV4cCI6MjA5MDI3MjUxM30.0zNGzy8aPM0rD1qLfWSOchKU0w8RxozS0sBS-zknxoc'),
    body := jsonb_build_object('tipo','coda_benvenuto'));
EXCEPTION WHEN OTHERS THEN
  -- La sveglia mancata non blocca: il giro ogni 5 minuti la recupera.
  RAISE WARNING 'sveglia_coda_benvenuto: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.sveglia_coda_benvenuto() FROM PUBLIC, anon, authenticated;

-- Presa in carico atomica: niente doppi invii fra due giri paralleli.
CREATE OR REPLACE FUNCTION public.prendi_benvenuti_da_inviare(p_limite integer DEFAULT 20)
RETURNS TABLE(domanda_id uuid, club_id uuid, atleta_id uuid, livello text, email_domanda text, tentativi integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.domande_iscrizione d
     SET mail_benvenuto_tentativi = d.mail_benvenuto_tentativi + 1,
         mail_benvenuto_ultimo_tentativo = now()
   WHERE d.id IN (
     SELECT id FROM public.domande_iscrizione
      WHERE mail_benvenuto_stato = 'da_inviare'
        AND atleta_id IS NOT NULL
        AND (mail_benvenuto_ultimo_tentativo IS NULL
             OR mail_benvenuto_ultimo_tentativo < now() - interval '3 minutes')
      ORDER BY gestita_il NULLS LAST
      LIMIT p_limite
      FOR UPDATE SKIP LOCKED)
  RETURNING d.id, d.club_id, d.atleta_id, d.livello_assegnato, d.genitore1_email, d.mail_benvenuto_tentativi;
$$;
REVOKE ALL ON FUNCTION public.prendi_benvenuti_da_inviare(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prendi_benvenuti_da_inviare(integer) TO service_role;

-- Lo staff chiede di rimandarla: torna in coda con tentativi azzerati.
CREATE OR REPLACE FUNCTION public.rimanda_mail_benvenuto(p_domanda uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d RECORD;
BEGIN
  SELECT * INTO d FROM public.domande_iscrizione WHERE id = p_domanda;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domanda inesistente'; END IF;
  IF NOT (public.user_is_admin_like()
          OR (d.club_id = public.user_club_id() AND public.puo_gestire_sportivo())) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE = '42501';
  END IF;
  IF d.stato <> 'approvata' OR d.atleta_id IS NULL THEN
    RAISE EXCEPTION 'La domanda non e'' approvata';
  END IF;
  IF d.mail_benvenuto_stato = 'inviata' THEN
    RAISE EXCEPTION 'La mail e'' gia'' stata inviata';
  END IF;
  UPDATE public.domande_iscrizione
     SET mail_benvenuto_stato = 'da_inviare', mail_benvenuto_motivo = NULL,
         mail_benvenuto_tentativi = 0, mail_benvenuto_ultimo_tentativo = NULL
   WHERE id = p_domanda;
  PERFORM public.sveglia_coda_benvenuto();
END $$;
REVOKE ALL ON FUNCTION public.rimanda_mail_benvenuto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rimanda_mail_benvenuto(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approva_domanda_iscrizione(p_domanda uuid, p_livello text DEFAULT NULL::text, p_categoria text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS TABLE(atleta_id uuid, codice_atleta text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
         note_risposta = p_note, gestita_da = auth.uid(), gestita_il = now(),
         mail_benvenuto_stato = 'da_inviare', mail_benvenuto_motivo = NULL,
         mail_benvenuto_tentativi = 0, mail_benvenuto_ultimo_tentativo = NULL
   WHERE id = p_domanda;

  PERFORM public.sveglia_coda_benvenuto();

  atleta_id := v_id; codice_atleta := v_cod; RETURN NEXT;
END $function$;

CREATE OR REPLACE FUNCTION public.valuta_iscrizione(p_atleta_id uuid, p_corso_id uuid)
 RETURNS TABLE(conforme boolean, motivo text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_liv_corso  text;
  v_nome_corso text;
  v_livelli    text[];
  v_ripiego    text;
  v_atleta     text;
  v_ammessi    text[];
begin
  select c.livello_richiesto, c.nome into v_liv_corso, v_nome_corso
    from public.corsi c where c.id = p_corso_id;

  if coalesce(btrim(coalesce(v_liv_corso,'')),'') = '' then
    return query select true, ''::text; return;
  end if;
  if lower(btrim(v_liv_corso)) in ('tutti','tutti i livelli') then
    return query select true, ''::text; return;
  end if;

  -- Livelli di categoria (modello nuovo). livello_attuale solo come ripiego
  -- quando nessun campo di categoria e' compilato.
  select array_remove(array[nullif(btrim(a.livello_amatori),''),
                            nullif(btrim(a.livello_artistica),''),
                            nullif(btrim(a.livello_stile),'')], null),
         nullif(btrim(a.livello_attuale),''),
         a.cognome||' '||a.nome
    into v_livelli, v_ripiego, v_atleta
    from public.atleti a where a.id = p_atleta_id;

  if coalesce(array_length(v_livelli,1),0) = 0 and v_ripiego is not null then
    v_livelli := array[v_ripiego];
  end if;

  select array_agg(btrim(x)) into v_ammessi
    from unnest(string_to_array(v_liv_corso, ',')) x
   where btrim(x) <> '';

  if v_livelli && v_ammessi then
    return query select true, ''::text; return;
  end if;

  return query select false, format(
    '%s e'' al livello %s e il corso "%s" chiede %s. Se l''iscrizione e'' voluta lo stesso, indica il motivo dell''eccezione e procedi.',
    coalesce(v_atleta,'L''atleta'),
    coalesce(nullif(array_to_string(v_livelli, ' / '),''),'non indicato'),
    coalesce(v_nome_corso,'scelto'),
    case when array_length(v_ammessi,1) = 1
         then 'il livello ' || v_ammessi[1]
         else 'uno fra ' || array_to_string(v_ammessi, ', ') end);
end $function$;

CREATE OR REPLACE FUNCTION public.corsi_per_atleta(p_atleta_id uuid)
 RETURNS TABLE(id uuid, club_id uuid, nome text, tipo text, giorno text, ora_inizio time without time zone, ora_fine time without time zone, costo_mensile numeric, costo_annuale numeric, attivo boolean, livello_richiesto text, percorso text, richiede_approvazione boolean, iscritto boolean, richiesta_in_attesa boolean, salto_livello boolean)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
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
      OR (c.percorso IS NULL AND c.livello_richiesto IN (a.livello_amatori, a.livello_artistica, a.ripiego))
      OR (c.percorso = 'artistica' AND c.livello_richiesto = a.livello_artistica)
      OR (c.percorso = 'stile' AND c.livello_richiesto = a.livello_stile)
      OR ia.corso_id IS NOT NULL
      OR rp.corso_id IS NOT NULL
    )
  ORDER BY c.giorno, c.ora_inizio;
$function$;

-- Riprova armata solo finché ci sono mail in coda: si disarma a coda vuota.
CREATE OR REPLACE FUNCTION public.arma_riprova_benvenuto()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'coda-benvenuto-riprova') THEN
    PERFORM cron.schedule('coda-benvenuto-riprova', '*/5 * * * *',
      'select public.sveglia_coda_benvenuto()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'arma_riprova_benvenuto: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.arma_riprova_benvenuto() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.disarma_riprova_benvenuto_se_vuota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.domande_iscrizione WHERE mail_benvenuto_stato = 'da_inviare') THEN
    PERFORM public.arma_riprova_benvenuto();
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'coda-benvenuto-riprova') THEN
    PERFORM cron.unschedule('coda-benvenuto-riprova');
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.disarma_riprova_benvenuto_se_vuota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disarma_riprova_benvenuto_se_vuota() TO service_role;

-- La sveglia arma anche la riprova.
CREATE OR REPLACE FUNCTION public.sveglia_coda_benvenuto()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.arma_riprova_benvenuto();
  PERFORM net.http_post(
    url := 'https://mdlfhdyyzrxppamlzepd.supabase.co/functions/v1/invia-email-iscrizioni',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbGZoZHl5enJ4cHBhbWx6ZXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTY1MTMsImV4cCI6MjA5MDI3MjUxM30.0zNGzy8aPM0rD1qLfWSOchKU0w8RxozS0sBS-zknxoc'),
    body := jsonb_build_object('tipo','coda_benvenuto'));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sveglia_coda_benvenuto: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.sveglia_coda_benvenuto() FROM PUBLIC, anon, authenticated;