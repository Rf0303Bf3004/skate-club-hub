CREATE TABLE public.inviti_genitori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id uuid NOT NULL,
  club_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  usato boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inviti_genitori ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.inviti_genitori
  FOR ALL USING (true) WITH CHECK (true);