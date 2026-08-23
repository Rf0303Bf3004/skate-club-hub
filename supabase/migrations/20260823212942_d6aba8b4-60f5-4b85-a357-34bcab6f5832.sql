ALTER TABLE public.griglia_sessioni_atleti
  ADD COLUMN IF NOT EXISTS provenienza text NOT NULL DEFAULT 'manuale',
  ADD COLUMN IF NOT EXISTS origine_corso_id uuid REFERENCES public.corsi(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conflitto_forzato boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_forzatura text,
  ADD COLUMN IF NOT EXISTS forzato_da uuid,
  ADD COLUMN IF NOT EXISTS forzato_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'griglia_sessioni_atleti_provenienza_chk'
  ) THEN
    ALTER TABLE public.griglia_sessioni_atleti
      ADD CONSTRAINT griglia_sessioni_atleti_provenienza_chk
      CHECK (provenienza IN ('manuale','gruppo','proposta'));
  END IF;
END $$;

UPDATE public.griglia_sessioni_atleti
SET provenienza = 'gruppo'
WHERE gruppo_sessione_id IS NOT NULL AND provenienza = 'manuale';

CREATE INDEX IF NOT EXISTS idx_gsa_origine_corso ON public.griglia_sessioni_atleti(origine_corso_id);