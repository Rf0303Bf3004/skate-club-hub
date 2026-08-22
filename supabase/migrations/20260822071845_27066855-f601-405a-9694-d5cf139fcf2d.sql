CREATE TABLE public.griglia_sessioni_gruppi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessione_id uuid NOT NULL REFERENCES public.griglia_sessioni(id) ON DELETE CASCADE,
  gruppo_livello text NOT NULL,
  gruppo_scope text NOT NULL CHECK (gruppo_scope IN ('ragione_sociale','club','senza_ragione_sociale','esterni')),
  gruppo_ragione_sociale_id uuid NULL REFERENCES public.ragioni_sociali(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_griglia_sessioni_gruppi_sessione ON public.griglia_sessioni_gruppi(sessione_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.griglia_sessioni_gruppi TO authenticated;
GRANT ALL ON public.griglia_sessioni_gruppi TO service_role;

ALTER TABLE public.griglia_sessioni_gruppi ENABLE ROW LEVEL SECURITY;

CREATE POLICY f6g_select ON public.griglia_sessioni_gruppi
FOR SELECT
USING (
  user_is_admin_like() OR (EXISTS (
    SELECT 1 FROM public.griglia_sessioni s
    JOIN public.griglia_blocchi b ON b.id = s.blocco_id
    WHERE s.id = griglia_sessioni_gruppi.sessione_id AND b.club_id = user_club_id()
  ))
);

CREATE POLICY f6g_write ON public.griglia_sessioni_gruppi
FOR ALL
USING (
  user_can_manage_griglia() AND (user_is_admin_like() OR (EXISTS (
    SELECT 1 FROM public.griglia_sessioni s
    JOIN public.griglia_blocchi b ON b.id = s.blocco_id
    WHERE s.id = griglia_sessioni_gruppi.sessione_id AND b.club_id = user_club_id()
  )))
)
WITH CHECK (
  user_can_manage_griglia() AND (user_is_admin_like() OR (EXISTS (
    SELECT 1 FROM public.griglia_sessioni s
    JOIN public.griglia_blocchi b ON b.id = s.blocco_id
    WHERE s.id = griglia_sessioni_gruppi.sessione_id AND b.club_id = user_club_id()
  )))
);

ALTER TABLE public.griglia_sessioni_atleti
  ADD COLUMN gruppo_sessione_id uuid NULL REFERENCES public.griglia_sessioni_gruppi(id) ON DELETE CASCADE;

CREATE INDEX idx_griglia_sessioni_atleti_gruppo ON public.griglia_sessioni_atleti(gruppo_sessione_id);

-- Migrazione dati dal vecchio modello (3 colonne su griglia_sessioni)
WITH nuovi AS (
  INSERT INTO public.griglia_sessioni_gruppi (sessione_id, gruppo_livello, gruppo_scope, gruppo_ragione_sociale_id)
  SELECT s.id, s.gruppo_livello,
         COALESCE(NULLIF(s.gruppo_scope, ''), 'club'),
         s.gruppo_ragione_sociale_id
  FROM public.griglia_sessioni s
  WHERE s.gruppo_livello IS NOT NULL
  RETURNING id, sessione_id
)
UPDATE public.griglia_sessioni_atleti a
SET gruppo_sessione_id = n.id
FROM nuovi n
WHERE a.sessione_id = n.sessione_id;

ALTER TABLE public.griglia_sessioni
  DROP COLUMN gruppo_livello,
  DROP COLUMN gruppo_scope,
  DROP COLUMN gruppo_ragione_sociale_id;