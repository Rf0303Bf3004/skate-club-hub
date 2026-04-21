
ALTER TABLE public.atleti
  ADD COLUMN IF NOT EXISTS portal_token text;

CREATE UNIQUE INDEX IF NOT EXISTS atleti_portal_token_unique
  ON public.atleti (portal_token)
  WHERE portal_token IS NOT NULL;
