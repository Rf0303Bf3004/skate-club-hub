ALTER TABLE public.convenzioni
ADD COLUMN IF NOT EXISTS telefono text,
ADD COLUMN IF NOT EXISTS sito_web text;