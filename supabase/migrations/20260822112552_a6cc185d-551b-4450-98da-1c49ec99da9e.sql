CREATE TABLE public.traduzioni_ui (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  namespace text NOT NULL,
  chiave text NOT NULL,
  it text,
  de text,
  fr text,
  rm text,
  en text,
  aggiornato_il timestamptz NOT NULL DEFAULT now(),
  aggiornato_da uuid,
  UNIQUE (namespace, chiave)
);

GRANT SELECT ON public.traduzioni_ui TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traduzioni_ui TO authenticated;
GRANT ALL ON public.traduzioni_ui TO service_role;

ALTER TABLE public.traduzioni_ui ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traduzioni_select_pubblico" ON public.traduzioni_ui
  FOR SELECT USING (true);

CREATE POLICY "traduzioni_insert_superadmin" ON public.traduzioni_ui
  FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());

CREATE POLICY "traduzioni_update_superadmin" ON public.traduzioni_ui
  FOR UPDATE TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "traduzioni_delete_superadmin" ON public.traduzioni_ui
  FOR DELETE TO authenticated USING (public.is_superadmin());

CREATE INDEX idx_traduzioni_ui_namespace ON public.traduzioni_ui(namespace);

CREATE TRIGGER trg_traduzioni_ui_updated
BEFORE UPDATE ON public.traduzioni_ui
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();