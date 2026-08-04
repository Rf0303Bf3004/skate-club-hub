ALTER TABLE public.atleti
  ADD COLUMN IF NOT EXISTS partecipa_gare boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intende_test_livello boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consenso_foto_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contratto_accettato_at timestamptz;

ALTER TABLE public.setup_club
  ADD COLUMN IF NOT EXISTS clausole_contratto text;