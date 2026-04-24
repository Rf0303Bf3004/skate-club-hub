ALTER TABLE public.atleti ADD COLUMN IF NOT EXISTS agonista boolean NOT NULL DEFAULT false;
UPDATE public.atleti SET agonista = true WHERE atleta_federazione = true AND agonista = false;