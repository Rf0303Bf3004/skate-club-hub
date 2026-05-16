CREATE TABLE public.relazioni_paragrafi_auto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  area_id text NOT NULL,
  paragrafo_ordine integer NOT NULL,
  tono text NOT NULL,
  contenuto text NOT NULL DEFAULT '',
  is_edited boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT relazioni_paragrafi_auto_unique UNIQUE (club_id, stagione_id, area_id, paragrafo_ordine, tono),
  CONSTRAINT relazioni_paragrafi_auto_ordine_chk CHECK (paragrafo_ordine BETWEEN 1 AND 4),
  CONSTRAINT relazioni_paragrafi_auto_tono_chk CHECK (tono IN ('soci','formale'))
);

CREATE INDEX idx_relazioni_paragrafi_auto_lookup
  ON public.relazioni_paragrafi_auto (club_id, stagione_id, area_id, tono);

ALTER TABLE public.relazioni_paragrafi_auto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON public.relazioni_paragrafi_auto
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_relazioni_paragrafi_auto_updated_at
  BEFORE UPDATE ON public.relazioni_paragrafi_auto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();