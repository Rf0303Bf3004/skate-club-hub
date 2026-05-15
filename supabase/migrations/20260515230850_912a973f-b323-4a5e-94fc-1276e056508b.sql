
ALTER TABLE public.atleti_storici_stagioni
  ADD COLUMN IF NOT EXISTS livello text;

CREATE TABLE IF NOT EXISTS public.test_storici_stagioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  sostenuti integer NOT NULL DEFAULT 0,
  superati integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, stagione_id)
);
ALTER TABLE public.test_storici_stagioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated"
  ON public.test_storici_stagioni FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.risultati_storici_stagioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  gare_disputate integer NOT NULL DEFAULT 0,
  podi_conquistati integer NOT NULL DEFAULT 0,
  atleti_gareggianti integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, stagione_id)
);
ALTER TABLE public.risultati_storici_stagioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated"
  ON public.risultati_storici_stagioni FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
