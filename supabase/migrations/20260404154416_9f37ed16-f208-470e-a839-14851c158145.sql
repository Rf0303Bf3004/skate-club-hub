CREATE TABLE public.configurazione_ghiaccio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  stagione_id uuid,
  ora_apertura_default time NOT NULL DEFAULT '06:00:00',
  ora_chiusura_default time NOT NULL DEFAULT '22:30:00',
  durata_pulizia_minuti integer NOT NULL DEFAULT 10,
  max_atleti_contemporanei integer NOT NULL DEFAULT 30,
  max_atleti_per_istruttore integer NOT NULL DEFAULT 8,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.configurazione_ghiaccio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.configurazione_ghiaccio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);