
ALTER TABLE public.iscrizioni_gare
  ADD COLUMN IF NOT EXISTS disciplina text DEFAULT '';

ALTER TABLE public.setup_club
  ADD COLUMN IF NOT EXISTS medagliere_punti jsonb DEFAULT '{"1":10,"2":7,"3":5,"4":3,"5":2,"6":1}'::jsonb;
