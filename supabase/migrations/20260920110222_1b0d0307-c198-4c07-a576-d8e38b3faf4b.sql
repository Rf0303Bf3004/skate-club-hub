ALTER TABLE public.istruttori
  ADD COLUMN IF NOT EXISTS data_inizio_attivita date NULL,
  ADD COLUMN IF NOT EXISTS gs_termine_esame date NULL;

COMMENT ON COLUMN public.istruttori.data_inizio_attivita IS 'Data in cui la persona ha iniziato a lavorare nel club: serve a calcolare il termine dei 12 mesi per sostenere l''esame G+S.';
COMMENT ON COLUMN public.istruttori.gs_termine_esame IS 'Termine entro cui la persona deve sostenere l''esame G+S, impostato a mano dal club. Se vuoto, il termine si calcola come 12 mesi dalla data di inizio attivita.';