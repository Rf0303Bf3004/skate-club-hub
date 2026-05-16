
CREATE TABLE public.relazione_preferenze (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  stagione_id UUID,
  sezione_tipo TEXT NOT NULL,
  sezione_id TEXT NOT NULL,
  attivo BOOLEAN NOT NULL DEFAULT true,
  ordine INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, stagione_id, sezione_id)
);

ALTER TABLE public.relazione_preferenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
ON public.relazione_preferenze
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER update_relazione_preferenze_updated_at
BEFORE UPDATE ON public.relazione_preferenze
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed per club Stella del Ghiaccio + stagione attiva
INSERT INTO public.relazione_preferenze (club_id, stagione_id, sezione_tipo, sezione_id, ordine, attivo)
SELECT '00030001-0000-0000-0000-000000000001'::uuid, s.id, v.tipo, v.sez, v.ord, true
FROM (SELECT id FROM public.stagioni WHERE club_id = '00030001-0000-0000-0000-000000000001'::uuid AND attiva = true LIMIT 1) s
CROSS JOIN (VALUES
  ('sistema','copertina',0),
  ('sistema','indice',5),
  ('area_dashboard','sintesi',10),
  ('area_dashboard','domanda',20),
  ('area_dashboard','atleti',30),
  ('area_dashboard','economia',40),
  ('area_dashboard','lezioni',50),
  ('area_dashboard','sportivo',60),
  ('area_dashboard','catalogo',70),
  ('sistema','chiusura',999)
) v(tipo,sez,ord)
ON CONFLICT (club_id, stagione_id, sezione_id) DO NOTHING;
