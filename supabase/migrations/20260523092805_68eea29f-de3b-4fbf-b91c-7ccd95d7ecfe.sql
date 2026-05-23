
-- Helper: finance/admin roles
CREATE OR REPLACE FUNCTION public.user_can_see_finance()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.utenti_club
    WHERE user_id = auth.uid()
      AND ruolo IN ('superadmin','admin','presidente','segreteria','dt')
  );
$$;
GRANT EXECUTE ON FUNCTION public.user_can_see_finance() TO authenticated;

-- Drop anon SELECT policies
DROP POLICY IF EXISTS "Public read corsi" ON public.corsi;
DROP POLICY IF EXISTS "Public read gare_calendario" ON public.gare_calendario;

-- Lock finance tables to finance roles
DO $$
DECLARE
  t text;
  finance_tables text[] := ARRAY[
    'cassa_movimenti','bilancio_stagione','fatture','costi_istruttori',
    'ore_lavorate_istruttori','ore_lavorate_dettaglio','setup_club','ricavi_per_fonte'
  ];
BEGIN
  FOREACH t IN ARRAY finance_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS f6_soft_all ON public.%I', t);
      EXECUTE format($p$
        CREATE POLICY "f6_finance_only" ON public.%I
        FOR ALL TO authenticated
        USING (public.user_is_admin_like() OR (public.user_can_see_finance() AND club_id = public.user_club_id()))
        WITH CHECK (public.user_is_admin_like() OR (public.user_can_see_finance() AND club_id = public.user_club_id()))
      $p$, t);
    END IF;
  END LOOP;
END $$;

-- Drop deprecated portal_token + its trigger/function chain
DROP TRIGGER IF EXISTS trg_atleti_set_portal_token ON public.atleti;
DROP FUNCTION IF EXISTS public.set_atleta_portal_token() CASCADE;
ALTER TABLE public.atleti DROP COLUMN IF EXISTS portal_token;

-- Hide instructor cost fields from non-finance via column-level REVOKE
REVOKE SELECT (
  costo_orario_corsi,
  costo_orario_lezioni,
  costo_minuto_lezione_privata,
  compenso_fisso_corsi,
  compenso_fisso_mensile
) ON public.istruttori FROM authenticated, anon, PUBLIC;

-- RPC returning instructor cost data to finance roles only
CREATE OR REPLACE FUNCTION public.get_istruttori_costi(p_club_id uuid)
RETURNS TABLE (
  id uuid,
  costo_orario_corsi numeric,
  costo_orario_lezioni numeric,
  costo_minuto_lezione_privata numeric,
  compenso_fisso_corsi numeric,
  compenso_fisso_mensile numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    i.id,
    i.costo_orario_corsi,
    i.costo_orario_lezioni,
    i.costo_minuto_lezione_privata,
    i.compenso_fisso_corsi,
    i.compenso_fisso_mensile
  FROM public.istruttori i
  WHERE i.club_id = p_club_id
    AND (
      public.user_is_admin_like()
      OR (public.user_can_see_finance() AND p_club_id = public.user_club_id())
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_istruttori_costi(uuid) TO authenticated;
