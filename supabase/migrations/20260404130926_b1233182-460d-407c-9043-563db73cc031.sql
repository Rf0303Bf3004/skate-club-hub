
-- Tipi corso (Ghiaccio, Off Ice, etc.)
CREATE TABLE public.tipi_corso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tipi_corso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.tipi_corso FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Corsi
CREATE TABLE public.corsi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  tipo text DEFAULT '',
  giorno text NOT NULL DEFAULT 'Lunedì',
  ora_inizio time NOT NULL DEFAULT '08:00:00',
  ora_fine time NOT NULL DEFAULT '09:00:00',
  costo_mensile numeric DEFAULT 0,
  costo_annuale numeric DEFAULT 0,
  attivo boolean DEFAULT true,
  note text DEFAULT '',
  livello_richiesto text DEFAULT 'tutti',
  stagione_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.corsi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.corsi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Corsi <-> Istruttori
CREATE TABLE public.corsi_istruttori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id uuid NOT NULL,
  istruttore_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(corso_id, istruttore_id)
);
ALTER TABLE public.corsi_istruttori ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.corsi_istruttori FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Iscrizioni corsi
CREATE TABLE public.iscrizioni_corsi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id uuid NOT NULL,
  atleta_id uuid NOT NULL,
  attiva boolean DEFAULT true,
  salto_livello boolean DEFAULT false,
  note_salto_livello text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.iscrizioni_corsi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.iscrizioni_corsi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Corsi monitori (monitore / aiuto_monitore)
CREATE TABLE public.corsi_monitori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id uuid NOT NULL,
  persona_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'monitore',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.corsi_monitori ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.corsi_monitori FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Presenze corso
CREATE TABLE public.presenze_corso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id uuid NOT NULL,
  atleta_id uuid NOT NULL,
  data date NOT NULL,
  presente boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.presenze_corso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.presenze_corso FOR ALL TO authenticated USING (true) WITH CHECK (true);
