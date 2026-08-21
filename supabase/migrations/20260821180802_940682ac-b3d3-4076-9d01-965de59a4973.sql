ALTER TABLE public.configurazione_ghiaccio
  ALTER COLUMN max_atleti_contemporanei DROP NOT NULL,
  ALTER COLUMN max_atleti_contemporanei DROP DEFAULT;

ALTER TABLE public.configurazione_ghiaccio
  ALTER COLUMN max_atleti_per_istruttore DROP NOT NULL;

ALTER TABLE public.configurazione_ghiaccio
  ALTER COLUMN min_iscritti_attivazione_corso DROP NOT NULL;