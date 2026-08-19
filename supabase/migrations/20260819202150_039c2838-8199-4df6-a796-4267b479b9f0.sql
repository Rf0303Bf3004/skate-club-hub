ALTER TABLE public.istruttori ADD COLUMN IF NOT EXISTS user_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_istruttori_user_id ON public.istruttori(user_id);