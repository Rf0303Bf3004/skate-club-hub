
CREATE TABLE public.impostazioni_planning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid,
  ora_inizio_giornata time NOT NULL DEFAULT '06:00:00',
  ora_fine_giornata time NOT NULL DEFAULT '22:30:00',
  durata_slot_minuti integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.impostazioni_planning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.impostazioni_planning FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.disponibilita_ghiaccio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  giorno text NOT NULL DEFAULT 'Lunedì',
  ora_inizio time NOT NULL,
  ora_fine time NOT NULL,
  stagione_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disponibilita_ghiaccio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.disponibilita_ghiaccio FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.disponibilita_istruttori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  istruttore_id uuid NOT NULL,
  club_id uuid NOT NULL,
  giorno text NOT NULL DEFAULT 'Lunedì',
  ora_inizio time NOT NULL,
  ora_fine time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disponibilita_istruttori ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.disponibilita_istruttori FOR ALL TO authenticated USING (true) WITH CHECK (true);
