ALTER TABLE public.istruttori
  ADD COLUMN IF NOT EXISTS tipo_contratto text NOT NULL DEFAULT 'orario',
  ADD COLUMN IF NOT EXISTS costo_orario_lezioni numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_orario_corsi numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compenso_fisso_mensile numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compenso_fisso_corsi numeric NOT NULL DEFAULT 0;