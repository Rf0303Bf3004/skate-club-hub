CREATE TABLE public.convenzioni_nazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.convenzioni_nazioni TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convenzioni_nazioni TO authenticated;
GRANT ALL ON public.convenzioni_nazioni TO service_role;

ALTER TABLE public.convenzioni_nazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nazioni leggibili da tutti" ON public.convenzioni_nazioni FOR SELECT USING (true);
CREATE POLICY "Solo superadmin gestisce nazioni" ON public.convenzioni_nazioni FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE TABLE public.convenzioni_regioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nazione_id uuid NOT NULL REFERENCES public.convenzioni_nazioni(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nazione_id, nome)
);

GRANT SELECT ON public.convenzioni_regioni TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convenzioni_regioni TO authenticated;
GRANT ALL ON public.convenzioni_regioni TO service_role;

ALTER TABLE public.convenzioni_regioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regioni leggibili da tutti" ON public.convenzioni_regioni FOR SELECT USING (true);
CREATE POLICY "Solo superadmin gestisce regioni" ON public.convenzioni_regioni FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

ALTER TABLE public.convenzioni ADD COLUMN regione_id uuid REFERENCES public.convenzioni_regioni(id) ON DELETE SET NULL;
CREATE INDEX idx_convenzioni_regione_id ON public.convenzioni(regione_id);

CREATE TRIGGER trg_convenzioni_nazioni_updated_at BEFORE UPDATE ON public.convenzioni_nazioni FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_convenzioni_regioni_updated_at BEFORE UPDATE ON public.convenzioni_regioni FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

WITH n AS (
  INSERT INTO public.convenzioni_nazioni (nome, ordine) VALUES ('Svizzera', 1), ('Italia', 2), ('Grecia', 3)
  RETURNING id, nome
)
INSERT INTO public.convenzioni_regioni (nazione_id, nome, ordine)
SELECT n.id, r.nome, r.ordine
FROM n
JOIN (VALUES
  ('Svizzera','Ticino',1),('Svizzera','Vallese',2),('Svizzera','Grigioni',3),('Svizzera','Vaud',4),('Svizzera','Zurigo',5),('Svizzera','Berna',6),('Svizzera','Ginevra',7),
  ('Italia','Lombardia',1),('Italia','Piemonte',2),('Italia','Toscana',3),('Italia','Veneto',4),('Italia','Trentino-Alto Adige',5),('Italia','Emilia-Romagna',6),('Italia','Lazio',7),
  ('Grecia','Attica',1),('Grecia','Creta',2),('Grecia','Peloponneso',3),('Grecia','Isole Ionie',4)
) AS r(nazione, nome, ordine) ON r.nazione = n.nome;