ALTER TABLE public.griglia_sessioni
  ADD COLUMN IF NOT EXISTS pista text NULL,
  ADD COLUMN IF NOT EXISTS messaggio_atleti text NULL;

ALTER TABLE public.griglia_specialita
  ADD COLUMN IF NOT EXISTS descrizione_messaggio text NULL;