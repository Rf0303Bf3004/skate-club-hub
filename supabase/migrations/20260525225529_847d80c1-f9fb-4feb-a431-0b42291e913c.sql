
-- 1) Sostituire colonna 'stato' generata con campo editabile
ALTER TABLE public.fatture DROP COLUMN IF EXISTS stato;
ALTER TABLE public.fatture ADD COLUMN stato text NOT NULL DEFAULT 'bozza'
  CHECK (stato IN ('bozza','inviata','pagata','scaduta','annullata'));

-- 2) Intestatario snapshot
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS intestatario_nome text,
  ADD COLUMN IF NOT EXISTS intestatario_cognome text,
  ADD COLUMN IF NOT EXISTS intestatario_indirizzo text,
  ADD COLUMN IF NOT EXISTS intestatario_cap text,
  ADD COLUMN IF NOT EXISTS intestatario_citta text,
  ADD COLUMN IF NOT EXISTS intestatario_cantone text,
  ADD COLUMN IF NOT EXISTS intestatario_email text;

-- 3) Sconto
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS sconto_importo_chf numeric(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sconto_percentuale numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sconto_causale text,
  ADD COLUMN IF NOT EXISTS sconto_note text;

-- 4) PDF + righe
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS righe jsonb;

-- 5) Trigger snapshot intestatario da atleta.genitore1_*
CREATE OR REPLACE FUNCTION public.fatture_snapshot_intestatario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a RECORD;
BEGIN
  IF NEW.atleta_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.intestatario_nome IS NOT NULL AND NEW.intestatario_cognome IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT genitore1_nome, genitore1_cognome, genitore1_indirizzo, genitore1_cap,
         genitore1_citta, genitore1_cantone, genitore1_email, nome, cognome
    INTO a FROM public.atleti WHERE id = NEW.atleta_id;
  IF FOUND THEN
    NEW.intestatario_nome      := COALESCE(NEW.intestatario_nome,      NULLIF(a.genitore1_nome,''),     a.nome);
    NEW.intestatario_cognome   := COALESCE(NEW.intestatario_cognome,   NULLIF(a.genitore1_cognome,''),  a.cognome);
    NEW.intestatario_indirizzo := COALESCE(NEW.intestatario_indirizzo, NULLIF(a.genitore1_indirizzo,''));
    NEW.intestatario_cap       := COALESCE(NEW.intestatario_cap,       NULLIF(a.genitore1_cap,''));
    NEW.intestatario_citta     := COALESCE(NEW.intestatario_citta,     NULLIF(a.genitore1_citta,''));
    NEW.intestatario_cantone   := COALESCE(NEW.intestatario_cantone,   NULLIF(a.genitore1_cantone,''));
    NEW.intestatario_email     := COALESCE(NEW.intestatario_email,     NULLIF(a.genitore1_email,''));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fatture_snapshot_intestatario ON public.fatture;
CREATE TRIGGER trg_fatture_snapshot_intestatario
  BEFORE INSERT ON public.fatture
  FOR EACH ROW EXECUTE FUNCTION public.fatture_snapshot_intestatario();

-- 6) Sync stato <-> pagata
CREATE OR REPLACE FUNCTION public.fatture_sync_stato_pagata()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pagata = true AND NEW.stato <> 'pagata' THEN NEW.stato := 'pagata'; END IF;
  IF NEW.stato = 'pagata' AND NEW.pagata <> true THEN
    NEW.pagata := true;
    IF NEW.data_pagamento IS NULL THEN NEW.data_pagamento := CURRENT_DATE; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fatture_sync_stato ON public.fatture;
CREATE TRIGGER trg_fatture_sync_stato
  BEFORE INSERT OR UPDATE ON public.fatture
  FOR EACH ROW EXECUTE FUNCTION public.fatture_sync_stato_pagata();
