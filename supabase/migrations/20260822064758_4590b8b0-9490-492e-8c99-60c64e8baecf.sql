ALTER TABLE public.griglia_sessioni
  ADD COLUMN IF NOT EXISTS gruppo_livello text,
  ADD COLUMN IF NOT EXISTS gruppo_scope text,
  ADD COLUMN IF NOT EXISTS gruppo_ragione_sociale_id uuid REFERENCES public.ragioni_sociali(id) ON DELETE SET NULL;

ALTER TABLE public.griglia_sessioni
  DROP CONSTRAINT IF EXISTS griglia_sessioni_gruppo_scope_chk;

ALTER TABLE public.griglia_sessioni
  ADD CONSTRAINT griglia_sessioni_gruppo_scope_chk
  CHECK (gruppo_scope IS NULL OR gruppo_scope IN ('ragione_sociale','club','senza_ragione_sociale','esterni'));

CREATE INDEX IF NOT EXISTS idx_griglia_sessioni_gruppo ON public.griglia_sessioni (gruppo_livello) WHERE gruppo_livello IS NOT NULL;