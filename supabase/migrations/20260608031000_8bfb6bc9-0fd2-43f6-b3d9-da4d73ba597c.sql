
CREATE TABLE public.convenzioni_tipi_proposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  formato text CHECK (formato IN ('percentuale','importo','testo')),
  ordine int NOT NULL DEFAULT 0,
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.convenzioni_tipi_proposta TO authenticated;
GRANT ALL ON public.convenzioni_tipi_proposta TO service_role;

ALTER TABLE public.convenzioni_tipi_proposta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipi_proposta_select_authenticated"
  ON public.convenzioni_tipi_proposta FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "tipi_proposta_insert_superadmin"
  ON public.convenzioni_tipi_proposta FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());

CREATE POLICY "tipi_proposta_update_superadmin"
  ON public.convenzioni_tipi_proposta FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "tipi_proposta_delete_superadmin"
  ON public.convenzioni_tipi_proposta FOR DELETE TO authenticated
  USING (public.is_superadmin());

INSERT INTO public.convenzioni_tipi_proposta (nome, formato, ordine) VALUES
  ('Sconto percentuale', 'percentuale', 1),
  ('Sconto fisso', 'importo', 2),
  ('Omaggio', 'testo', 3),
  ('2x1 / Promozione', 'testo', 4),
  ('Vantaggio riservato soci', 'testo', 5),
  ('Altro', 'testo', 6);

ALTER TABLE public.convenzioni
  ADD COLUMN tipo_proposta_id uuid REFERENCES public.convenzioni_tipi_proposta(id),
  ADD COLUMN valore_proposta text;
