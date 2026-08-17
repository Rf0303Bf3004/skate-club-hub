CREATE TABLE public.convenzioni_province (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regione_id uuid NOT NULL REFERENCES public.convenzioni_regioni(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regione_id, nome)
);

GRANT SELECT ON public.convenzioni_province TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convenzioni_province TO authenticated;
GRANT ALL ON public.convenzioni_province TO service_role;

ALTER TABLE public.convenzioni_province ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Province leggibili da tutti" ON public.convenzioni_province FOR SELECT USING (true);
CREATE POLICY "Solo superadmin gestisce province" ON public.convenzioni_province FOR ALL TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE TRIGGER update_convenzioni_province_updated_at
BEFORE UPDATE ON public.convenzioni_province
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.convenzioni
  ADD COLUMN provincia_id uuid REFERENCES public.convenzioni_province(id) ON DELETE SET NULL,
  ADD COLUMN stelle smallint,
  ADD COLUMN tipo_cucina text,
  ADD COLUMN fascia_prezzo text;

ALTER TABLE public.convenzioni
  ADD CONSTRAINT convenzioni_stelle_range CHECK (stelle IS NULL OR (stelle BETWEEN 1 AND 5));

INSERT INTO public.convenzioni_province (regione_id, nome, ordine)
SELECT r.id, p.nome, p.ordine
FROM (VALUES
  ('Ticino','Lugano',1),('Ticino','Bellinzona',2),('Ticino','Locarno',3),('Ticino','Mendrisio',4),
  ('Vallese','Sion',1),('Vallese','Briga',2),('Vallese','Monthey',3),
  ('Grigioni','Coira',1),('Grigioni','Davos',2),('Grigioni','Engadina',3),
  ('Vaud','Losanna',1),('Vaud','Montreux',2),('Vaud','Nyon',3),
  ('Zurigo','Zurigo',1),('Zurigo','Winterthur',2),
  ('Berna','Berna',1),('Berna','Thun',2),('Berna','Interlaken',3),
  ('Ginevra','Ginevra',1),
  ('Lombardia','Milano',1),('Lombardia','Bergamo',2),('Lombardia','Brescia',3),('Lombardia','Como',4),('Lombardia','Varese',5),('Lombardia','Sondrio',6),
  ('Piemonte','Torino',1),('Piemonte','Cuneo',2),('Piemonte','Novara',3),('Piemonte','Asti',4),
  ('Toscana','Firenze',1),('Toscana','Siena',2),('Toscana','Grosseto',3),('Toscana','Pisa',4),('Toscana','Lucca',5),
  ('Veneto','Venezia',1),('Veneto','Verona',2),('Veneto','Padova',3),('Veneto','Treviso',4),('Veneto','Belluno',5),
  ('Trentino-Alto Adige','Trento',1),('Trentino-Alto Adige','Bolzano',2),
  ('Emilia-Romagna','Bologna',1),('Emilia-Romagna','Modena',2),('Emilia-Romagna','Rimini',3),('Emilia-Romagna','Parma',4),
  ('Lazio','Roma',1),('Lazio','Latina',2),('Lazio','Viterbo',3),
  ('Attica','Atene',1),('Attica','Pireo',2),
  ('Creta','Chania',1),('Creta','Heraklion',2),
  ('Peloponneso','Kalamata',1),('Peloponneso','Nafplio',2),
  ('Isole Ionie','Corfu',1),('Isole Ionie','Zante',2)
) AS p(regione, nome, ordine)
JOIN public.convenzioni_regioni r ON r.nome = p.regione
ON CONFLICT (regione_id, nome) DO NOTHING;