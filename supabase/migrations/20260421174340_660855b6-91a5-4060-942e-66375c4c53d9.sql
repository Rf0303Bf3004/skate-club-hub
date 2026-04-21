-- Tabella eventi/campi (interno o esterno)
CREATE TABLE IF NOT EXISTS public.eventi_campi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid,
  nome text NOT NULL DEFAULT '',
  modalita text NOT NULL DEFAULT 'interno', -- 'interno' | 'esterno'
  data_inizio date,
  data_fine date,
  luogo text DEFAULT '',
  descrizione text DEFAULT '',
  costo numeric DEFAULT 0,
  contatti text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eventi_campi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.eventi_campi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sessioni planning del campo interno
CREATE TABLE IF NOT EXISTS public.sessioni_campo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_campo_id uuid NOT NULL REFERENCES public.eventi_campi(id) ON DELETE CASCADE,
  data date NOT NULL,
  ora_inizio time NOT NULL,
  ora_fine time NOT NULL,
  titolo text NOT NULL DEFAULT '',
  istruttore_id uuid,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sessioni_campo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.sessioni_campo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Iscrizioni atleti agli eventi/campi
CREATE TABLE IF NOT EXISTS public.iscrizioni_eventi_campi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_campo_id uuid NOT NULL REFERENCES public.eventi_campi(id) ON DELETE CASCADE,
  atleta_id uuid NOT NULL,
  stato text NOT NULL DEFAULT 'iscritto',
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evento_campo_id, atleta_id)
);
ALTER TABLE public.iscrizioni_eventi_campi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.iscrizioni_eventi_campi FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_eventi_campi_club ON public.eventi_campi(club_id);
CREATE INDEX IF NOT EXISTS idx_sessioni_campo_evento ON public.sessioni_campo(evento_campo_id);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_eventi_campi_evento ON public.iscrizioni_eventi_campi(evento_campo_id);