
-- 1. club_identity
CREATE TABLE public.club_identity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  anno_fondazione INTEGER,
  federazione TEXT DEFAULT '',
  mission TEXT DEFAULT '',
  citta TEXT DEFAULT '',
  sito_web TEXT,
  email_contatto TEXT DEFAULT '',
  social_instagram TEXT,
  social_facebook TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.club_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.club_identity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. sponsor_attivi
CREATE TABLE public.sponsor_attivi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  nome_sponsor TEXT NOT NULL DEFAULT '',
  categoria TEXT DEFAULT '',
  livello TEXT NOT NULL DEFAULT 'bronze',
  importo_annuo NUMERIC NOT NULL DEFAULT 0,
  stagione_inizio INTEGER,
  stagione_fine INTEGER,
  descrizione_breve TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsor_attivi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.sponsor_attivi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. sponsor_categorie_cercate
CREATE TABLE public.sponsor_categorie_cercate (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  descrizione_offerta TEXT DEFAULT '',
  importo_richiesto_indicativo NUMERIC NOT NULL DEFAULT 0,
  priorita TEXT NOT NULL DEFAULT 'media',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsor_categorie_cercate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.sponsor_categorie_cercate FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. eventi_pubblici
CREATE TABLE public.eventi_pubblici (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  stagione_id UUID,
  nome_evento TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'evento',
  data_evento TEXT DEFAULT '',
  partecipanti_stimati INTEGER NOT NULL DEFAULT 0,
  descrizione TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eventi_pubblici ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.eventi_pubblici FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. materiali_promo
CREATE TABLE public.materiali_promo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'documento',
  titolo TEXT NOT NULL DEFAULT '',
  descrizione TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.materiali_promo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.materiali_promo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── SEED ───────────────────────────────────────────────────────────
-- club_identity
INSERT INTO public.club_identity (club_id, anno_fondazione, federazione, mission, citta, email_contatto)
VALUES (
  '00030001-0000-0000-0000-000000000001',
  1987,
  'FISG - Federazione Italiana Sport del Ghiaccio',
  'Da quasi 40 anni cresciamo pattinatori, dai primi passi sul ghiaccio fino all''agonismo nazionale.',
  'Lugano, Svizzera',
  'info@stelladelghiaccio.ch'
);

-- sponsor_attivi
INSERT INTO public.sponsor_attivi (club_id, nome_sponsor, categoria, livello, importo_annuo, stagione_inizio, descrizione_breve) VALUES
('00030001-0000-0000-0000-000000000001','Banca del Ticino','bancario','gold',8000,2010,'Partner finanziario storico del club dal 2010'),
('00030001-0000-0000-0000-000000000001','Ottica Bellini','salute','silver',3500,2020,'Visite della vista gratuite per gli atleti'),
('00030001-0000-0000-0000-000000000001','Pasticceria San Giorgio','ristorazione','bronze',1500,2022,'Torte celebrative per gare e galà'),
('00030001-0000-0000-0000-000000000001','AutoSwiss Lugano','automotive','silver',4000,2021,'Trasporti per le trasferte di gara'),
('00030001-0000-0000-0000-000000000001','SportLine Equipment','abbigliamento','bronze',2000,2023,'Sconti su lame e attrezzatura');

-- sponsor_categorie_cercate
INSERT INTO public.sponsor_categorie_cercate (club_id, categoria, descrizione_offerta, importo_richiesto_indicativo, priorita) VALUES
('00030001-0000-0000-0000-000000000001','pista','Sponsor primario per copertura ore aggiuntive di ghiaccio',15000,'alta'),
('00030001-0000-0000-0000-000000000001','tecnologico','Sponsor per nuovo software gestionale e tablet istruttori',5000,'media'),
('00030001-0000-0000-0000-000000000001','media/comunicazione','Sponsor per campagna social e materiali promozionali',3000,'media');

-- eventi_pubblici (stagione 2025/2026 - prendiamo l'id dinamicamente)
INSERT INTO public.eventi_pubblici (club_id, stagione_id, nome_evento, tipo, data_evento, partecipanti_stimati, descrizione)
SELECT
  '00030001-0000-0000-0000-000000000001',
  (SELECT id FROM public.stagioni WHERE club_id = '00030001-0000-0000-0000-000000000001' AND nome LIKE '%2025%2026%' LIMIT 1),
  v.nome, v.tipo, v.data_evento, v.partecipanti, v.descr
FROM (VALUES
  ('Galà di Natale 2025','gala','8 dicembre 2025',350,'Esibizione di fine semestre aperta a soci e cittadinanza'),
  ('Open Day Pulcini','open_day','15 settembre 2025',80,'Pomeriggio gratuito di prova per bambini'),
  ('Dimostrazione in Piazza Riforma','dimostrazione_piazza','6 dicembre 2025',500,'Pattinaggio in piazza per Santa Lucia'),
  ('Progetto Scuole Lugano','scuole','ottobre 2025 - aprile 2026',220,'Lezioni nelle scuole elementari di Lugano')
) AS v(nome, tipo, data_evento, partecipanti, descr);

-- materiali_promo
INSERT INTO public.materiali_promo (club_id, tipo, titolo, descrizione, file_url) VALUES
('00030001-0000-0000-0000-000000000001','brochure_club','Brochure Club 2025/26','Presentazione completa del club, dei corsi e dei programmi','#'),
('00030001-0000-0000-0000-000000000001','presentazione_sponsor','Presentazione per Sponsor','Slides per incontri con potenziali partner commerciali','#'),
('00030001-0000-0000-0000-000000000001','scheda_tecnica','Scheda Tecnica Federale FISG','Statistiche aggregate per relazione annuale FISG','#');
