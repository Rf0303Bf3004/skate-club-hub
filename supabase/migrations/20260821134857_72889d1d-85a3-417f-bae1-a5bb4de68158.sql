ALTER TABLE public.griglia_blocchi
  ADD COLUMN IF NOT EXISTS fuori_disponibilita boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_forzatura text,
  ADD COLUMN IF NOT EXISTS forzato_da uuid,
  ADD COLUMN IF NOT EXISTS forzato_at timestamptz;

ALTER TABLE public.griglia_sessioni
  ADD COLUMN IF NOT EXISTS fuori_disponibilita boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_forzatura text,
  ADD COLUMN IF NOT EXISTS forzato_da uuid,
  ADD COLUMN IF NOT EXISTS forzato_at timestamptz;