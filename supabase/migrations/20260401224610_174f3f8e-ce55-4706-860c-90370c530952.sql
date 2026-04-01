
CREATE TABLE public.atleti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  cognome TEXT NOT NULL DEFAULT '',
  data_nascita DATE,
  percorso_amatori TEXT DEFAULT 'Pulcini',
  carriera_artistica TEXT,
  carriera_stile TEXT,
  atleta_federazione BOOLEAN DEFAULT false,
  ore_pista_stagione INTEGER DEFAULT 0,
  genitore1_nome TEXT DEFAULT '',
  genitore1_cognome TEXT DEFAULT '',
  genitore1_telefono TEXT DEFAULT '',
  genitore1_email TEXT DEFAULT '',
  genitore2_nome TEXT DEFAULT '',
  genitore2_cognome TEXT DEFAULT '',
  genitore2_telefono TEXT DEFAULT '',
  genitore2_email TEXT DEFAULT '',
  attivo BOOLEAN DEFAULT true,
  note TEXT DEFAULT '',
  disco_in_preparazione TEXT,
  tag_nfc TEXT,
  foto_url TEXT,
  disco_url TEXT,
  ruolo_pista TEXT DEFAULT 'atleta',
  compenso_orario_pista NUMERIC DEFAULT 0,
  attivo_come_monitore BOOLEAN DEFAULT false,
  codice_fiscale TEXT DEFAULT '',
  luogo_nascita TEXT DEFAULT '',
  indirizzo TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  licenza_sis_numero TEXT DEFAULT '',
  licenza_sis_categoria TEXT DEFAULT '',
  licenza_sis_disciplina TEXT DEFAULT '',
  licenza_sis_validita_a DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.atleti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.atleti
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
