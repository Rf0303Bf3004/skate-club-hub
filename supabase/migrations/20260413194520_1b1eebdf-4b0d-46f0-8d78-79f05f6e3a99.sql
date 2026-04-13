
CREATE TABLE public.test_livello (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  stagione_id uuid,
  nome text NOT NULL DEFAULT '',
  data date,
  ora time without time zone,
  luogo text DEFAULT '',
  tipo text NOT NULL DEFAULT 'artistica',
  livello_testato text DEFAULT '',
  livello_successivo text DEFAULT '',
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.test_livello ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.test_livello
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.test_livello_atleti (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES public.test_livello(id) ON DELETE CASCADE,
  atleta_id uuid NOT NULL REFERENCES public.atleti(id) ON DELETE CASCADE,
  esito text NOT NULL DEFAULT 'in_attesa',
  note_istruttore text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.test_livello_atleti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.test_livello_atleti
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
