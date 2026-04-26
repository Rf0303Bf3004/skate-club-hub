
-- 1. Drop tabella obsoleta
DROP TABLE IF EXISTS public.post_season_atlete;

-- 2. Tabella eventi esterni (ospitati da club terzi)
CREATE TABLE public.eventi_esterni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid,
  tipo text NOT NULL DEFAULT 'pre_season', -- 'pre_season' | 'post_season' | 'stage' | 'raduno' | 'altro'
  nome text NOT NULL DEFAULT '',
  struttura_nome text NOT NULL DEFAULT '',
  struttura_citta text DEFAULT '',
  struttura_contatti text DEFAULT '',
  data_inizio date,
  data_fine date,
  disciplina text DEFAULT '',
  descrizione text DEFAULT '',
  costo_indicativo numeric DEFAULT 0,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eventi_esterni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.eventi_esterni
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read eventi_esterni" ON public.eventi_esterni
  FOR SELECT TO anon USING (true);

CREATE TRIGGER trg_eventi_esterni_updated_at
  BEFORE UPDATE ON public.eventi_esterni
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Iscrizioni atlete a eventi esterni
CREATE TABLE public.iscrizioni_eventi_esterni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_esterno_id uuid NOT NULL,
  atleta_id uuid NOT NULL,
  quota_atleta numeric DEFAULT 0,
  quota_club numeric DEFAULT 0,
  stato_pagamento text NOT NULL DEFAULT 'da_pagare', -- 'da_pagare' | 'parziale' | 'pagato'
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_esterno_id, atleta_id)
);

ALTER TABLE public.iscrizioni_eventi_esterni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.iscrizioni_eventi_esterni
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read iscrizioni_eventi_esterni" ON public.iscrizioni_eventi_esterni
  FOR SELECT TO anon USING (true);

CREATE TRIGGER trg_iscrizioni_eventi_esterni_updated_at
  BEFORE UPDATE ON public.iscrizioni_eventi_esterni
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_iscrizioni_eventi_esterni_evento ON public.iscrizioni_eventi_esterni(evento_esterno_id);
CREATE INDEX idx_iscrizioni_eventi_esterni_atleta ON public.iscrizioni_eventi_esterni(atleta_id);
CREATE INDEX idx_eventi_esterni_club ON public.eventi_esterni(club_id);
CREATE INDEX idx_eventi_esterni_stagione ON public.eventi_esterni(stagione_id);

-- 4. Storage buckets pubblici
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('foto-atleti', 'foto-atleti', true),
  ('loghi-club', 'loghi-club', true),
  ('dischi-musicali', 'dischi-musicali', true)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS policies sui bucket
-- Lettura pubblica (i 3 bucket sono pubblici, le foto profilo / loghi / dischi devono essere accessibili via URL diretto)
CREATE POLICY "Public read foto-atleti"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'foto-atleti');

CREATE POLICY "Public read loghi-club"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'loghi-club');

CREATE POLICY "Public read dischi-musicali"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dischi-musicali');

-- Upload/Update/Delete consentiti a tutti gli utenti autenticati
-- (admin, superadmin, istruttori, genitori). La logica fine di ownership
-- (genitore puo' caricare solo la foto del proprio figlio) e' gia' gestita
-- a livello applicativo dal portale.
CREATE POLICY "Authenticated upload foto-atleti"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'foto-atleti');

CREATE POLICY "Authenticated update foto-atleti"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'foto-atleti');

CREATE POLICY "Authenticated delete foto-atleti"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'foto-atleti');

CREATE POLICY "Authenticated upload loghi-club"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'loghi-club');

CREATE POLICY "Authenticated update loghi-club"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'loghi-club');

CREATE POLICY "Authenticated delete loghi-club"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'loghi-club');

CREATE POLICY "Authenticated upload dischi-musicali"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dischi-musicali');

CREATE POLICY "Authenticated update dischi-musicali"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dischi-musicali');

CREATE POLICY "Authenticated delete dischi-musicali"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dischi-musicali');
