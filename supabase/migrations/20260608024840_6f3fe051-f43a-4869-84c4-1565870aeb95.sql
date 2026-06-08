
-- Helper: superadmin check
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.utenti_club WHERE user_id = auth.uid() AND ruolo = 'superadmin');
$$;

-- 1) convenzioni_aree
CREATE TABLE public.convenzioni_aree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  icona text,
  ordine int NOT NULL DEFAULT 0,
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.convenzioni_aree TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.convenzioni_aree TO authenticated;
GRANT ALL ON public.convenzioni_aree TO service_role;
ALTER TABLE public.convenzioni_aree ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aree_select_all" ON public.convenzioni_aree FOR SELECT USING (true);
CREATE POLICY "aree_insert_superadmin" ON public.convenzioni_aree FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());
CREATE POLICY "aree_update_superadmin" ON public.convenzioni_aree FOR UPDATE TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "aree_delete_superadmin" ON public.convenzioni_aree FOR DELETE TO authenticated USING (public.is_superadmin());

-- 2) convenzioni
CREATE TABLE public.convenzioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES public.convenzioni_aree(id) ON DELETE SET NULL,
  azienda text NOT NULL,
  titolo text NOT NULL,
  descrizione text,
  logo_url text,
  immagine_url text,
  indirizzo text,
  geo_cantone text,
  geo_citta text,
  validita_da date,
  validita_a date,
  codice_sconto text,
  qr_token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  stato text NOT NULL DEFAULT 'attiva',
  in_evidenza boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.convenzioni TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.convenzioni TO authenticated;
GRANT ALL ON public.convenzioni TO service_role;
ALTER TABLE public.convenzioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_select_all" ON public.convenzioni FOR SELECT USING (true);
CREATE POLICY "conv_insert_superadmin" ON public.convenzioni FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());
CREATE POLICY "conv_update_superadmin" ON public.convenzioni FOR UPDATE TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "conv_delete_superadmin" ON public.convenzioni FOR DELETE TO authenticated USING (public.is_superadmin());

-- 3) convenzioni_scansioni
CREATE TABLE public.convenzioni_scansioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_token text,
  convenzione_id uuid REFERENCES public.convenzioni(id) ON DELETE SET NULL,
  scansionato_at timestamptz NOT NULL DEFAULT now(),
  club_id uuid,
  atleta_id uuid,
  user_agent text
);
GRANT INSERT ON public.convenzioni_scansioni TO anon, authenticated;
GRANT SELECT ON public.convenzioni_scansioni TO authenticated;
GRANT ALL ON public.convenzioni_scansioni TO service_role;
ALTER TABLE public.convenzioni_scansioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_insert_any" ON public.convenzioni_scansioni FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "scan_select_superadmin" ON public.convenzioni_scansioni FOR SELECT TO authenticated USING (public.is_superadmin());

-- Seed aree
INSERT INTO public.convenzioni_aree (nome, icona, ordine) VALUES
  ('Sport e attrezzatura', 'dumbbell', 1),
  ('Auto e mobilita', 'car', 2),
  ('Ristorazione e bar', 'utensils', 3),
  ('Salute e benessere', 'heart-pulse', 4),
  ('Abbigliamento e calzature', 'shirt', 5),
  ('Casa e servizi', 'home', 6),
  ('Tempo libero e cultura', 'ticket', 7),
  ('Viaggi', 'plane', 8);
