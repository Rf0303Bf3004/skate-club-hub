-- a) Riempi la stagione mancante sulle fasce esistenti, con la stagione attiva del club.
UPDATE public.disponibilita_ghiaccio d
SET stagione_id = s.id
FROM public.stagioni s
WHERE d.stagione_id IS NULL
  AND s.club_id = d.club_id
  AND s.attiva = true;

-- b) Trigger: una fascia inserita senza stagione appartiene alla stagione attiva del club.
--    Serve perché le schermate esistenti (Setup del club, onboarding) inseriscono le fasce
--    senza indicare la stagione: senza questo riempimento automatico le fasce nuove
--    resterebbero "senza anno" e non seguirebbero il passaggio di stagione.
CREATE OR REPLACE FUNCTION public.disponibilita_ghiaccio_stagione_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stagione_id IS NULL THEN
    SELECT s.id INTO NEW.stagione_id
    FROM public.stagioni s
    WHERE s.club_id = NEW.club_id AND s.attiva = true
    ORDER BY s.data_inizio DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.disponibilita_ghiaccio_stagione_default() IS
  'Assegna alla fascia di disponibilità la stagione attiva del club quando chi inserisce non la indica. Se il club non ha una stagione attiva la fascia resta senza stagione: non si inventa un anno.';

DROP TRIGGER IF EXISTS trg_disponibilita_ghiaccio_stagione_default ON public.disponibilita_ghiaccio;
CREATE TRIGGER trg_disponibilita_ghiaccio_stagione_default
BEFORE INSERT ON public.disponibilita_ghiaccio
FOR EACH ROW EXECUTE FUNCTION public.disponibilita_ghiaccio_stagione_default();

-- d) Indice per le letture per club e stagione.
CREATE INDEX IF NOT EXISTS idx_disponibilita_ghiaccio_club_stagione
  ON public.disponibilita_ghiaccio (club_id, stagione_id);

-- c) Il controllo del ghiaccio sui blocchi guarda solo le fasce della stessa stagione
--    (tollerando le fasce senza stagione, per non bloccare un club senza stagione attiva).
CREATE OR REPLACE FUNCTION public.griglia_valida_disponibilita_ghiaccio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giorno text;
  v_tipo_risorsa text;
  v_ospite boolean;
  v_ok boolean;
  v_fasce int;
  v_pulizia record;
BEGIN
  IF COALESCE(NEW.fuori_disponibilita, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.evento_campo_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.risorsa_id IS NOT NULL THEN
    SELECT r.tipo, COALESCE(r.is_ospite, false) INTO v_tipo_risorsa, v_ospite
    FROM public.risorse_strutture r WHERE r.id = NEW.risorsa_id;
    IF v_tipo_risorsa IS DISTINCT FROM 'ghiaccio' OR COALESCE(v_ospite, false) THEN
      RETURN NEW;
    END IF;
  END IF;

  v_giorno := (ARRAY['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'])[EXTRACT(DOW FROM NEW.data)::int + 1];

  SELECT count(*) INTO v_fasce
  FROM public.disponibilita_ghiaccio d
  WHERE d.club_id = NEW.club_id
    AND d.tipo = 'ghiaccio'
    AND lower(translate(d.giorno, 'ìàèéù', 'iaeeu')) = lower(translate(v_giorno, 'ìàèéù', 'iaeeu'))
    AND (d.risorsa_id IS NULL OR NEW.risorsa_id IS NULL OR d.risorsa_id = NEW.risorsa_id)
    AND (d.stagione_id IS NULL OR d.stagione_id = NEW.stagione_id);

  IF v_fasce = 0 THEN
    RAISE EXCEPTION 'Nessuna disponibilità di ghiaccio dichiarata per % : indica un motivo per forzare il blocco.', v_giorno
      USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.disponibilita_ghiaccio d
    WHERE d.club_id = NEW.club_id
      AND d.tipo = 'ghiaccio'
      AND lower(translate(d.giorno, 'ìàèéù', 'iaeeu')) = lower(translate(v_giorno, 'ìàèéù', 'iaeeu'))
      AND (d.risorsa_id IS NULL OR NEW.risorsa_id IS NULL OR d.risorsa_id = NEW.risorsa_id)
      AND (d.stagione_id IS NULL OR d.stagione_id = NEW.stagione_id)
      AND d.ora_inizio <= NEW.ora_inizio
      AND d.ora_fine >= NEW.ora_fine
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Orario % - % fuori dalle fasce di ghiaccio disponibili di %: indica un motivo per forzare il blocco.',
      to_char(NEW.ora_inizio, 'HH24:MI'), to_char(NEW.ora_fine, 'HH24:MI'), v_giorno
      USING ERRCODE = '23514';
  END IF;

  -- Rifacimento del ghiaccio: la pista non è utilizzabile mentre passa la macchina.
  SELECT d.ora_inizio, d.ora_fine INTO v_pulizia
  FROM public.disponibilita_ghiaccio d
  WHERE d.club_id = NEW.club_id
    AND d.tipo = 'pulizia'
    AND lower(translate(d.giorno, 'ìàèéù', 'iaeeu')) = lower(translate(v_giorno, 'ìàèéù', 'iaeeu'))
    AND (d.risorsa_id IS NULL OR NEW.risorsa_id IS NULL OR d.risorsa_id = NEW.risorsa_id)
    AND (d.stagione_id IS NULL OR d.stagione_id = NEW.stagione_id)
    AND d.ora_inizio < NEW.ora_fine
    AND d.ora_fine > NEW.ora_inizio
  ORDER BY d.ora_inizio
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Orario % - % si sovrappone al rifacimento del ghiaccio delle % - % di %: sposta l''orario oppure indica un motivo per forzare il blocco.',
      to_char(NEW.ora_inizio, 'HH24:MI'), to_char(NEW.ora_fine, 'HH24:MI'),
      to_char(v_pulizia.ora_inizio, 'HH24:MI'), to_char(v_pulizia.ora_fine, 'HH24:MI'), v_giorno
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.disponibilita_ghiaccio.stagione_id IS
  'Stagione a cui appartiene la fascia oraria. Riempita in automatico con la stagione attiva del club quando non viene indicata; le fasce senza stagione restano valide per tutte le stagioni.';