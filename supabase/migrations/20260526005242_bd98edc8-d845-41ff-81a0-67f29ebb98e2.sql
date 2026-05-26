ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS paese_iso text NOT NULL DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS regione text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS codice_fiscale text;

ALTER TABLE public.atleti
  ADD COLUMN IF NOT EXISTS paese_iso text NOT NULL DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS regione text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS genitore1_paese_iso text,
  ADD COLUMN IF NOT EXISTS genitore1_regione text,
  ADD COLUMN IF NOT EXISTS genitore1_provincia text,
  ADD COLUMN IF NOT EXISTS genitore2_paese_iso text,
  ADD COLUMN IF NOT EXISTS genitore2_regione text,
  ADD COLUMN IF NOT EXISTS genitore2_provincia text;

ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS intestatario_paese_iso text,
  ADD COLUMN IF NOT EXISTS intestatario_regione text,
  ADD COLUMN IF NOT EXISTS intestatario_provincia text;

ALTER TABLE public.fatture_clubs
  ADD COLUMN IF NOT EXISTS intestatario_paese_iso text DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS intestatario_regione text,
  ADD COLUMN IF NOT EXISTS intestatario_provincia text;