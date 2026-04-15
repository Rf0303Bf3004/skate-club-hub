
CREATE TABLE public.risultati_gara (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gara_id uuid NOT NULL,
  atleta_id uuid NULL,
  atleta_nome_esterno text NOT NULL DEFAULT '',
  club_esterno text NOT NULL DEFAULT '',
  rank integer NULL,
  starting_number integer NULL,
  tot numeric NULL DEFAULT 0,
  tes numeric NULL DEFAULT 0,
  pcs numeric NULL DEFAULT 0,
  deductions numeric NULL DEFAULT 0,
  pcs_presentation numeric NULL DEFAULT 0,
  pcs_skating_skills numeric NULL DEFAULT 0,
  categoria text NOT NULL DEFAULT '',
  gruppo text NOT NULL DEFAULT '',
  disciplina text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.risultati_gara ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.risultati_gara
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.elementi_gara (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  risultato_id uuid NOT NULL REFERENCES public.risultati_gara(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  nome text NOT NULL DEFAULT '',
  base_value numeric NULL DEFAULT 0,
  goe numeric NULL DEFAULT 0,
  score numeric NULL DEFAULT 0,
  info_flag text NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.elementi_gara ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.elementi_gara
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
