
-- =========================================================
-- Relazione Presidente: blocchi testo + allegati
-- =========================================================

CREATE TABLE public.relazioni_blocchi_testo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  stagione_id UUID REFERENCES public.stagioni(id) ON DELETE SET NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('apertura','staff','eventi_futuri','trattative','progetti','conclusioni','altro')),
  titolo TEXT NOT NULL,
  contenuto TEXT NOT NULL DEFAULT '',
  ordine INTEGER NOT NULL DEFAULT 0,
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relazioni_blocchi_club_stagione_ordine
  ON public.relazioni_blocchi_testo (club_id, stagione_id, ordine);

ALTER TABLE public.relazioni_blocchi_testo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.relazioni_blocchi_testo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_relazioni_blocchi_updated
  BEFORE UPDATE ON public.relazioni_blocchi_testo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.relazioni_allegati (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  stagione_id UUID REFERENCES public.stagioni(id) ON DELETE SET NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('bilancio','federazione','certificazione','contratto_sponsor','verbale','altro')),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  ordine INTEGER NOT NULL DEFAULT 0,
  attivo BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relazioni_allegati_club_stagione_ordine
  ON public.relazioni_allegati (club_id, stagione_id, ordine);

ALTER TABLE public.relazioni_allegati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.relazioni_allegati
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =========================================================
-- Storage bucket privato per gli allegati
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('relazioni-allegati', 'relazioni-allegati', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read relazioni-allegati"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'relazioni-allegati');

CREATE POLICY "Auth insert relazioni-allegati"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'relazioni-allegati');

CREATE POLICY "Auth update relazioni-allegati"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'relazioni-allegati');

CREATE POLICY "Auth delete relazioni-allegati"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'relazioni-allegati');


-- =========================================================
-- Seed demo (Stella del Ghiaccio, stagione 2025/2026)
-- =========================================================
INSERT INTO public.relazioni_blocchi_testo (club_id, stagione_id, categoria, titolo, ordine, contenuto) VALUES
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','apertura',
   'Messaggio del Presidente', 10,
   'La stagione 2025/2026 eّ stata una stagione di consolidamento. Con 145 atleti iscritti e una piramide in salute, il club continua a crescere come punto di riferimento del pattinaggio a Lugano e nel Canton Ticino.'),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','staff',
   'Movimenti staff fine stagione', 20,
   'A fine stagione l''istruttrice Barbara Sella lascerà il club per intraprendere un percorso professionale all''estero. Le subentrerà la nuova istruttrice Federica Marchetti, ex agonista nazionale, che porterà nuove competenze nel percorso Stellina.'),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','eventi_futuri',
   'Eventi e progetti 2026/2027', 30,
   'La prossima stagione vedrà tre nuovi appuntamenti: un Galà di apertura a Settembre 2026, una collaborazione con il Conservatorio della Svizzera italiana per uno spettacolo musicale, e l''estensione del progetto Scuole a 4 istituti di Lugano.'),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','trattative',
   'Negoziazioni in corso', 40,
   'Stiamo trattando con la proprietà della pista di Resega per ottenere 2 ore aggiuntive di ghiaccio a settimana, necessarie per assorbire la lista d''attesa di 86 atleti. Parallelamente cerchiamo uno sponsor primario di categoria ''pista'' (CHF 15''000/anno) per coprire l''investimento.');

INSERT INTO public.relazioni_allegati (club_id, stagione_id, categoria, titolo, descrizione, file_url, ordine) VALUES
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','bilancio',
   'Bilancio Stagione 2025/2026','Bilancio civilistico e gestionale completo',
   'placeholder://bilancio-2025-2026.pdf', 10),
  ('00030001-0000-0000-0000-000000000001','00030001-0000-0000-0000-000000000010','federazione',
   'Scheda Federale FISG 2025/2026','Scheda di affiliazione federale annuale',
   'placeholder://fisg-2025-2026.pdf', 20);
