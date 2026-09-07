CREATE TABLE public.fornitore_piattaforma (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true,
  nome text not null,
  indirizzo text not null,
  cap text not null,
  citta text not null,
  cantone text,
  paese text not null default 'Svizzera',
  paese_iso text not null default 'CH',
  ide text,
  numero_iva text,
  iban text,
  email_info text not null,
  email_fatture text,
  updated_at timestamptz not null default now(),
  CONSTRAINT fornitore_piattaforma_singleton_true CHECK (singleton = true),
  CONSTRAINT fornitore_piattaforma_singleton_unique UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornitore_piattaforma TO authenticated;
GRANT ALL ON public.fornitore_piattaforma TO service_role;

ALTER TABLE public.fornitore_piattaforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_select_fornitore" ON public.fornitore_piattaforma
  FOR SELECT TO authenticated USING (public.is_superadmin());
CREATE POLICY "superadmin_insert_fornitore" ON public.fornitore_piattaforma
  FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());
CREATE POLICY "superadmin_update_fornitore" ON public.fornitore_piattaforma
  FOR UPDATE TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "superadmin_delete_fornitore" ON public.fornitore_piattaforma
  FOR DELETE TO authenticated USING (public.is_superadmin());

INSERT INTO public.fornitore_piattaforma
  (nome, indirizzo, cap, citta, cantone, paese, paese_iso, ide, numero_iva, iban, email_info, email_fatture)
VALUES
  ('SC2-INTECH Sagl', 'Piazza Nosetto 4b', '6500', 'Bellinzona', 'TI', 'Svizzera', 'CH',
   'CHE-489.434.744', 'CHE-489.434.744 MWST', NULL, 'info@icearena.ch', 'fatture@icearena.ch');

CREATE VIEW public.fornitore_piattaforma_pubblico
  WITH (security_invoker = false) AS
  SELECT nome, indirizzo, cap, citta, cantone, paese, ide, email_info
  FROM public.fornitore_piattaforma;

GRANT SELECT ON public.fornitore_piattaforma_pubblico TO anon, authenticated;