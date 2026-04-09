
-- Tabella settimane di planning
CREATE TABLE public.planning_settimane (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  stagione_id UUID,
  data_lunedi DATE NOT NULL,
  stato TEXT NOT NULL DEFAULT 'bozza',
  copiata_da UUID,
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(club_id, data_lunedi)
);

ALTER TABLE public.planning_settimane ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.planning_settimane
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Corsi nella settimana
CREATE TABLE public.planning_corsi_settimana (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settimana_id UUID NOT NULL REFERENCES public.planning_settimane(id) ON DELETE CASCADE,
  corso_id UUID NOT NULL,
  data DATE NOT NULL,
  ora_inizio TIME WITHOUT TIME ZONE NOT NULL,
  ora_fine TIME WITHOUT TIME ZONE NOT NULL,
  istruttore_id UUID,
  annullato BOOLEAN NOT NULL DEFAULT false,
  motivo TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planning_corsi_settimana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.planning_corsi_settimana
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Private nella settimana
CREATE TABLE public.planning_private_settimana (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settimana_id UUID NOT NULL REFERENCES public.planning_settimane(id) ON DELETE CASCADE,
  lezione_privata_id UUID NOT NULL,
  data DATE NOT NULL,
  ora_inizio TIME WITHOUT TIME ZONE NOT NULL,
  ora_fine TIME WITHOUT TIME ZONE NOT NULL,
  istruttore_id UUID,
  annullato BOOLEAN NOT NULL DEFAULT false,
  motivo TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planning_private_settimana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.planning_private_settimana
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Aggiunta colonna data_revoca a lezioni_private
ALTER TABLE public.lezioni_private ADD COLUMN IF NOT EXISTS data_revoca DATE DEFAULT NULL;
