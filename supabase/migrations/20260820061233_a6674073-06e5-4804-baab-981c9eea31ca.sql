CREATE TABLE public.risorse_strutture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ghiaccio','palestra')),
  ordine integer NOT NULL DEFAULT 0,
  attiva boolean NOT NULL DEFAULT true,
  colore text,
  capienza_max integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.risorse_strutture TO authenticated;
GRANT ALL ON public.risorse_strutture TO service_role;

ALTER TABLE public.risorse_strutture ENABLE ROW LEVEL SECURITY;

CREATE POLICY risorse_select ON public.risorse_strutture
FOR SELECT USING (public.user_is_admin_like() OR club_id = public.user_club_id());

CREATE POLICY risorse_write ON public.risorse_strutture
FOR ALL USING (public.user_is_admin_like() OR (public.user_is_presidente() AND club_id = public.user_club_id()))
WITH CHECK (public.user_is_admin_like() OR (public.user_is_presidente() AND club_id = public.user_club_id()));

CREATE INDEX idx_risorse_strutture_club ON public.risorse_strutture(club_id);

CREATE TRIGGER trg_risorse_strutture_updated_at
BEFORE UPDATE ON public.risorse_strutture
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.risorse_strutture (club_id, nome, tipo, ordine)
SELECT c.id, 'Pista principale', 'ghiaccio', 0 FROM public.clubs c;