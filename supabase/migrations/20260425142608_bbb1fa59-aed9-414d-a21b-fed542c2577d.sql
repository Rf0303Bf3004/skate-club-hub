CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.post_season_atlete (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  stagione_id UUID,
  atleta_id UUID NOT NULL,
  struttura_nome TEXT NOT NULL DEFAULT '',
  struttura_citta TEXT DEFAULT '',
  struttura_contatti TEXT DEFAULT '',
  disciplina TEXT DEFAULT '',
  data_inizio DATE,
  data_fine DATE,
  costo_totale NUMERIC DEFAULT 0,
  quota_atleta NUMERIC DEFAULT 0,
  quota_club NUMERIC DEFAULT 0,
  stato_pagamento TEXT NOT NULL DEFAULT 'da_pagare',
  note TEXT DEFAULT '',
  documenti_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_season_atlete ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON public.post_season_atlete
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_post_season_atlete_club ON public.post_season_atlete(club_id);
CREATE INDEX idx_post_season_atlete_stagione ON public.post_season_atlete(stagione_id);
CREATE INDEX idx_post_season_atlete_atleta ON public.post_season_atlete(atleta_id);

CREATE TRIGGER update_post_season_atlete_updated_at
BEFORE UPDATE ON public.post_season_atlete
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();