ALTER TABLE public.convenzioni
  ADD COLUMN IF NOT EXISTS pubblicazione_da date,
  ADD COLUMN IF NOT EXISTS pubblicazione_a date;