
-- Tabella comunicazioni
CREATE TABLE public.comunicazioni (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  titolo TEXT NOT NULL DEFAULT '',
  testo TEXT NOT NULL DEFAULT '',
  tipo_destinatari TEXT NOT NULL DEFAULT 'tutti',
  corso_id UUID,
  atleta_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comunicazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.comunicazioni
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabella richieste_iscrizione
CREATE TABLE public.richieste_iscrizione (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  atleta_id UUID NOT NULL,
  corso_id UUID NOT NULL,
  stato TEXT NOT NULL DEFAULT 'in_attesa',
  note_richiesta TEXT DEFAULT '',
  note_risposta TEXT DEFAULT '',
  gestita_da TEXT DEFAULT '',
  gestita_il TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.richieste_iscrizione ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.richieste_iscrizione
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
