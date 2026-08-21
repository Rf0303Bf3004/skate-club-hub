CREATE TABLE public.catalogo_livelli (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  stagione_id uuid REFERENCES public.stagioni(id) ON DELETE SET NULL,
  livello text NOT NULL,
  iscritti_attuali integer NOT NULL DEFAULT 0,
  max_atleti_pista integer NOT NULL DEFAULT 1,
  max_per_monitrice integer NOT NULL DEFAULT 1,
  lezioni_per_settimana integer NOT NULL DEFAULT 1,
  durata_minuti integer NOT NULL DEFAULT 15,
  costo_annuale numeric NOT NULL DEFAULT 0,
  tipo_sessione_default text NOT NULL DEFAULT 'standard',
  atleti_per_area integer NOT NULL DEFAULT 0,
  usa_corsie boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_livelli TO authenticated;
GRANT ALL ON public.catalogo_livelli TO service_role;
ALTER TABLE public.catalogo_livelli ENABLE ROW LEVEL SECURITY;

CREATE POLICY f6_soft_all ON public.catalogo_livelli
  FOR ALL USING (public.user_is_admin_like() OR club_id = public.user_club_id())
  WITH CHECK (public.user_is_admin_like() OR club_id = public.user_club_id());

CREATE INDEX idx_catalogo_livelli_club ON public.catalogo_livelli(club_id);

CREATE TRIGGER trg_catalogo_livelli_updated_at BEFORE UPDATE ON public.catalogo_livelli
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();