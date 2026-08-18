CREATE TABLE public.impostazioni_app_mobile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ios_store_url text,
  android_store_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.impostazioni_app_mobile TO authenticated;
GRANT INSERT, UPDATE ON public.impostazioni_app_mobile TO authenticated;
GRANT ALL ON public.impostazioni_app_mobile TO service_role;

ALTER TABLE public.impostazioni_app_mobile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_mobile_select_authenticated"
ON public.impostazioni_app_mobile FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_mobile_insert_superadmin"
ON public.impostazioni_app_mobile FOR INSERT TO authenticated
WITH CHECK (public.is_superadmin());

CREATE POLICY "app_mobile_update_superadmin"
ON public.impostazioni_app_mobile FOR UPDATE TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE TRIGGER trg_app_mobile_updated_at
BEFORE UPDATE ON public.impostazioni_app_mobile
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.impostazioni_app_mobile (ios_store_url, android_store_url)
VALUES ('https://apps.apple.com/app/ice-arena/id0000000000', 'https://play.google.com/store/apps/details?id=com.icearena.app');