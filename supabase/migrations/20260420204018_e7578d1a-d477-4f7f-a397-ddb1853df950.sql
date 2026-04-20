ALTER TABLE public.corsi ADD COLUMN IF NOT EXISTS categoria text NULL;

UPDATE public.corsi SET tipo = CASE
  WHEN tipo ILIKE 'ghiaccio' THEN 'Ghiaccio'
  WHEN tipo ILIKE 'off-ice' OR tipo ILIKE 'off_ice' THEN 'Off-Ice'
  ELSE tipo
END WHERE tipo IS NOT NULL;

ALTER TABLE public.corsi DROP CONSTRAINT IF EXISTS corsi_tipo_check;
ALTER TABLE public.corsi ADD CONSTRAINT corsi_tipo_check CHECK (tipo IN ('Ghiaccio', 'Off-Ice'));