
-- Tabella lezioni private
CREATE TABLE public.lezioni_private (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  istruttore_id UUID,
  data DATE,
  ora_inizio TIME WITHOUT TIME ZONE,
  ora_fine TIME WITHOUT TIME ZONE,
  durata_minuti INTEGER NOT NULL DEFAULT 20,
  condivisa BOOLEAN NOT NULL DEFAULT false,
  costo_totale NUMERIC NOT NULL DEFAULT 0,
  ricorrente BOOLEAN NOT NULL DEFAULT false,
  annullata BOOLEAN NOT NULL DEFAULT false,
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lezioni_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.lezioni_private
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabella atleti associati a lezioni private
CREATE TABLE public.lezioni_private_atlete (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lezione_id UUID NOT NULL REFERENCES public.lezioni_private(id) ON DELETE CASCADE,
  atleta_id UUID NOT NULL,
  quota_costo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lezioni_private_atlete ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.lezioni_private_atlete
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
