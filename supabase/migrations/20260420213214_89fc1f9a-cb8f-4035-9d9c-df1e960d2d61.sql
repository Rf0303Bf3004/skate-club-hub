ALTER TABLE public.corsi DROP CONSTRAINT IF EXISTS corsi_tipo_check;
ALTER TABLE public.corsi ADD CONSTRAINT corsi_tipo_check CHECK (tipo IN ('Ghiaccio', 'Off-Ice'));