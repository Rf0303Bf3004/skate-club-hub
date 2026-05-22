
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS banner_onboarding_chiuso boolean NOT NULL DEFAULT false;

ALTER TABLE public.corsi
  ADD COLUMN IF NOT EXISTS capienza_max integer;
