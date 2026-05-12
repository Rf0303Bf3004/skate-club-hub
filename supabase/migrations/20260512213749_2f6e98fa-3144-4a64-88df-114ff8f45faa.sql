
CREATE TABLE IF NOT EXISTS public.ruoli_permessi_sezioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  ruolo TEXT NOT NULL,
  codice_sezione TEXT NOT NULL,
  visibile BOOLEAN NOT NULL DEFAULT true,
  ordine INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, ruolo, codice_sezione)
);

CREATE INDEX IF NOT EXISTS idx_ruoli_permessi_sezioni_club_ruolo
  ON public.ruoli_permessi_sezioni (club_id, ruolo);

ALTER TABLE public.ruoli_permessi_sezioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rps_select_authenticated" ON public.ruoli_permessi_sezioni
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rps_insert_authenticated" ON public.ruoli_permessi_sezioni
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rps_update_authenticated" ON public.ruoli_permessi_sezioni
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "rps_delete_authenticated" ON public.ruoli_permessi_sezioni
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_ruoli_permessi_sezioni_updated_at
  BEFORE UPDATE ON public.ruoli_permessi_sezioni
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
