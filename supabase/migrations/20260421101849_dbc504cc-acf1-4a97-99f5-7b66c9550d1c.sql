ALTER TABLE public.configurazione_ghiaccio
  ADD COLUMN IF NOT EXISTS max_atleti_lezione_privata integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS modalita_costo_privata text NOT NULL DEFAULT 'tariffa_fissa';