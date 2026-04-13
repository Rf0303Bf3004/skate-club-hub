
CREATE TABLE public.adesioni_atleta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  atleta_id uuid NOT NULL REFERENCES public.atleti(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'stagione',
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  stagione_id uuid REFERENCES public.stagioni(id) ON DELETE SET NULL,
  note text DEFAULT '',
  stato text NOT NULL DEFAULT 'attiva',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.adesioni_atleta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON public.adesioni_atleta
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_adesioni_atleta_atleta ON public.adesioni_atleta(atleta_id);
CREATE INDEX idx_adesioni_atleta_club ON public.adesioni_atleta(club_id);
CREATE INDEX idx_adesioni_atleta_dates ON public.adesioni_atleta(data_inizio, data_fine);
