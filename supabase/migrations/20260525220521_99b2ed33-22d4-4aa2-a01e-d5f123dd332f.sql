
-- Clubs: nuovi campi tariffazione
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS mesi_fatturazione_fee smallint NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS mesi_fatturazione_atleti smallint NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS mese_inizio_fatturazione smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS costo_setup_chf numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_fatturato boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.clubs ADD CONSTRAINT clubs_mesi_fee_chk CHECK (mesi_fatturazione_fee BETWEEN 0 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clubs ADD CONSTRAINT clubs_mesi_atleti_chk CHECK (mesi_fatturazione_atleti BETWEEN 0 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clubs ADD CONSTRAINT clubs_mese_inizio_chk CHECK (mese_inizio_fatturazione BETWEEN 1 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fatture clubs: nuove colonne
ALTER TABLE public.fatture_clubs
  ADD COLUMN IF NOT EXISTS importo_atleti_chf numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importo_setup_chf numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stato text NOT NULL DEFAULT 'bozza',
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS data_invio timestamptz,
  ADD COLUMN IF NOT EXISTS righe_custom jsonb;

-- Sincronizza stato per record storici già pagati
UPDATE public.fatture_clubs SET stato = 'pagata' WHERE pagata = true AND stato = 'bozza';

DO $$ BEGIN
  ALTER TABLE public.fatture_clubs
    ADD CONSTRAINT fatture_clubs_stato_chk
    CHECK (stato IN ('bozza','inviata','pagata','scaduta','annullata'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage bucket privato per i PDF
INSERT INTO storage.buckets (id, name, public)
VALUES ('fatture-clubs', 'fatture-clubs', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: solo superadmin può leggere/scrivere i PDF
DROP POLICY IF EXISTS "fatture_clubs_pdf_superadmin_select" ON storage.objects;
CREATE POLICY "fatture_clubs_pdf_superadmin_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fatture-clubs' AND public.user_has_ruolo('superadmin'));

DROP POLICY IF EXISTS "fatture_clubs_pdf_superadmin_insert" ON storage.objects;
CREATE POLICY "fatture_clubs_pdf_superadmin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fatture-clubs' AND public.user_has_ruolo('superadmin'));

DROP POLICY IF EXISTS "fatture_clubs_pdf_superadmin_update" ON storage.objects;
CREATE POLICY "fatture_clubs_pdf_superadmin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'fatture-clubs' AND public.user_has_ruolo('superadmin'))
WITH CHECK (bucket_id = 'fatture-clubs' AND public.user_has_ruolo('superadmin'));

DROP POLICY IF EXISTS "fatture_clubs_pdf_superadmin_delete" ON storage.objects;
CREATE POLICY "fatture_clubs_pdf_superadmin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fatture-clubs' AND public.user_has_ruolo('superadmin'));
