
-- 1. Switch mobile_* helpers to read app_metadata (server-controlled) instead of user_metadata
CREATE OR REPLACE FUNCTION public.is_mobile_parent()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'mobile_parent'; $$;

CREATE OR REPLACE FUNCTION public.mobile_atleta_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NULLIF((auth.jwt() -> 'app_metadata' ->> 'atleta_id'), '')::uuid; $$;

CREATE OR REPLACE FUNCTION public.mobile_club_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NULLIF((auth.jwt() -> 'app_metadata' ->> 'club_id'), '')::uuid; $$;

-- 2. Drop public/anon read & write policies on sensitive tables
DROP POLICY IF EXISTS "Public read atleta by portal_token" ON public.atleti;
DROP POLICY IF EXISTS "Public read fatture" ON public.fatture;
DROP POLICY IF EXISTS "Public read comunicazioni" ON public.comunicazioni;
DROP POLICY IF EXISTS "Public read comunicazioni_destinatari" ON public.comunicazioni_destinatari;
DROP POLICY IF EXISTS "Public update comunicazioni_destinatari" ON public.comunicazioni_destinatari;
DROP POLICY IF EXISTS "Public read lezioni_private" ON public.lezioni_private;
DROP POLICY IF EXISTS "Public read lezioni_private_atlete" ON public.lezioni_private_atlete;

-- 3. inviti_genitori: rimuovi accesso pubblico, mantieni solo authenticated
DROP POLICY IF EXISTS "Allow all for now" ON public.inviti_genitori;
CREATE POLICY "inviti_genitori_authenticated_all" ON public.inviti_genitori
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
