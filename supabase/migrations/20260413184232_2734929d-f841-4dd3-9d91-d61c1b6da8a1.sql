
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  citta text DEFAULT '',
  paese text DEFAULT '',
  email text DEFAULT '',
  telefono text DEFAULT '',
  indirizzo text DEFAULT '',
  sito_web text DEFAULT '',
  numero_tessera_federale text DEFAULT '',
  colore_primario text DEFAULT '#3B82F6',
  descrizione text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.clubs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.setup_club (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  max_lezioni_private_contemporanee integer DEFAULT 2,
  max_atlete_lezione_condivisa integer DEFAULT 3,
  slot_lezione_privata_minuti integer DEFAULT 20,
  iban text DEFAULT '',
  intestatario_conto text DEFAULT '',
  banca text DEFAULT '',
  indirizzo_banca text DEFAULT '',
  twint_paylink text DEFAULT '',
  data_inizio_stagione date,
  data_fine_stagione date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.setup_club ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.setup_club FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.stagioni (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'Regolare',
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  attiva boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.stagioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.stagioni FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.presenze (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  persona_id uuid NOT NULL,
  tipo_persona text NOT NULL DEFAULT 'atleta',
  data date NOT NULL,
  ora_entrata text,
  ora_uscita text,
  metodo text DEFAULT 'manuale',
  riferimento_id uuid,
  tipo_riferimento text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.presenze ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.presenze FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.fatture (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  atleta_id uuid,
  descrizione text DEFAULT '',
  importo numeric DEFAULT 0,
  data_scadenza date,
  pagata boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.fatture ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.fatture FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.istruttori (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  cognome text NOT NULL DEFAULT '',
  telefono text DEFAULT '',
  email text DEFAULT '',
  attivo boolean DEFAULT true,
  costo_minuto_lezione_privata numeric DEFAULT 0,
  specialita text DEFAULT '',
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.istruttori ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.istruttori FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.storico_livelli_atleta (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atleta_id uuid NOT NULL,
  livello text NOT NULL,
  carriera text DEFAULT '',
  data_inizio date NOT NULL,
  data_fine date,
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.storico_livelli_atleta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.storico_livelli_atleta FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.campi_allenamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  luogo text DEFAULT '',
  data_inizio date,
  data_fine date,
  costo numeric DEFAULT 0,
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.campi_allenamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.campi_allenamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.iscrizioni_campo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campo_id uuid NOT NULL,
  atleta_id uuid NOT NULL,
  tipo text DEFAULT 'diurno',
  giorni_selezionati jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.iscrizioni_campo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.iscrizioni_campo FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.iscrizioni_gare (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gara_id uuid NOT NULL,
  atleta_id uuid NOT NULL,
  carriera text DEFAULT '',
  livello_atleta text,
  punteggio numeric,
  punteggio_tecnico numeric,
  punteggio_artistico numeric,
  posizione integer,
  medaglia text DEFAULT '',
  voto_giudici numeric,
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.iscrizioni_gare ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.iscrizioni_gare FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gare_calendario (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  data date,
  luogo text DEFAULT '',
  livello_minimo text DEFAULT '',
  stagione_id uuid,
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.gare_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.gare_calendario FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.comunicazioni_template (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL,
  nome text NOT NULL DEFAULT '',
  testo text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.comunicazioni_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.comunicazioni_template FOR ALL TO authenticated USING (true) WITH CHECK (true);
