ALTER TABLE public.istruttori 
  ALTER COLUMN costo_orario_lezioni DROP NOT NULL,
  ALTER COLUMN costo_orario_corsi DROP NOT NULL,
  ALTER COLUMN compenso_fisso_mensile DROP NOT NULL,
  ALTER COLUMN compenso_fisso_corsi DROP NOT NULL;