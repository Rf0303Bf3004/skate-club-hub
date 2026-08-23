CREATE TABLE public.proposte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id),
  stagione_id uuid REFERENCES public.stagioni(id),
  nome text NOT NULL,
  descrizione text,
  livello_id uuid REFERENCES public.livelli(id),
  prezzo_mensile numeric,
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposte TO authenticated;
GRANT ALL ON public.proposte TO service_role;

ALTER TABLE public.proposte ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposte_select ON public.proposte
  FOR SELECT TO authenticated
  USING (user_is_admin_like() OR club_id = user_club_id());

CREATE POLICY proposte_write ON public.proposte
  FOR ALL TO authenticated
  USING (user_is_admin_like() OR ((user_is_presidente() OR user_has_ruolo('dt')) AND club_id = user_club_id()))
  WITH CHECK (user_is_admin_like() OR ((user_is_presidente() OR user_has_ruolo('dt')) AND club_id = user_club_id()));

CREATE INDEX idx_proposte_club ON public.proposte(club_id, attiva);

ALTER TABLE public.corsi ADD COLUMN proposta_id uuid REFERENCES public.proposte(id) ON DELETE SET NULL;
CREATE INDEX idx_corsi_proposta ON public.corsi(proposta_id);