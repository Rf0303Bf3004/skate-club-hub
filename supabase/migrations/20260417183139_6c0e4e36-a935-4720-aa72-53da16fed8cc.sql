-- 1. Estensione planning_corsi_settimana
ALTER TABLE public.planning_corsi_settimana
  ADD COLUMN IF NOT EXISTS sostituisce_id uuid REFERENCES public.planning_corsi_settimana(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_evento_extra boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS titolo_override text,
  ADD COLUMN IF NOT EXISTS note_settimana text,
  ADD COLUMN IF NOT EXISTS evento_straordinario_id uuid,
  ADD COLUMN IF NOT EXISTS creato_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS creato_da uuid,
  ADD COLUMN IF NOT EXISTS modificato_at timestamptz NOT NULL DEFAULT now();

-- 2. Tabella eventi_straordinari
CREATE TABLE IF NOT EXISTS public.eventi_straordinari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  stagione_id uuid,
  titolo text NOT NULL DEFAULT '',
  descrizione text DEFAULT '',
  data date NOT NULL,
  ora_inizio time,
  ora_fine time,
  luogo text DEFAULT '',
  tipo text NOT NULL DEFAULT 'evento',
  creato_at timestamptz NOT NULL DEFAULT now(),
  creato_da uuid
);
ALTER TABLE public.eventi_straordinari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.eventi_straordinari;
CREATE POLICY "Allow all for authenticated" ON public.eventi_straordinari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabella iscrizioni_eventi
CREATE TABLE IF NOT EXISTS public.iscrizioni_eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventi_straordinari(id) ON DELETE CASCADE,
  atleta_id uuid NOT NULL,
  stato text NOT NULL DEFAULT 'iscritto',
  note text DEFAULT '',
  creato_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.iscrizioni_eventi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.iscrizioni_eventi;
CREATE POLICY "Allow all for authenticated" ON public.iscrizioni_eventi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Estensione comunicazioni
ALTER TABLE public.comunicazioni
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'generica',
  ADD COLUMN IF NOT EXISTS corpo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS planning_corso_id uuid,
  ADD COLUMN IF NOT EXISTS evento_straordinario_id uuid,
  ADD COLUMN IF NOT EXISTS programmata_per timestamptz,
  ADD COLUMN IF NOT EXISTS stato text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deep_link text,
  ADD COLUMN IF NOT EXISTS richiede_rsvp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rsvp_scadenza timestamptz,
  ADD COLUMN IF NOT EXISTS inviata_at timestamptz,
  ADD COLUMN IF NOT EXISTS creata_da uuid;

-- 5. Tabella comunicazioni_destinatari
CREATE TABLE IF NOT EXISTS public.comunicazioni_destinatari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicazione_id uuid NOT NULL REFERENCES public.comunicazioni(id) ON DELETE CASCADE,
  atleta_id uuid NOT NULL,
  stato text NOT NULL DEFAULT 'pending',
  letto_at timestamptz,
  rsvp_risposta text,
  rsvp_at timestamptz,
  creato_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comunicazione_id, atleta_id)
);
ALTER TABLE public.comunicazioni_destinatari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.comunicazioni_destinatari;
CREATE POLICY "Allow all for authenticated" ON public.comunicazioni_destinatari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Tabella device_tokens
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id uuid,
  user_id uuid,
  token text NOT NULL,
  piattaforma text NOT NULL DEFAULT 'web',
  attivo boolean NOT NULL DEFAULT true,
  creato_at timestamptz NOT NULL DEFAULT now(),
  ultimo_uso_at timestamptz,
  UNIQUE(token)
);
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.device_tokens;
CREATE POLICY "Allow all for authenticated" ON public.device_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Funzione get_atleti_impattati_da_planning
CREATE OR REPLACE FUNCTION public.get_atleti_impattati_da_planning(p_planning_corso_id uuid)
RETURNS TABLE(atleta_id uuid, nome text, cognome text, telefono text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.nome, a.cognome, a.telefono
  FROM public.planning_corsi_settimana pcs
  JOIN public.iscrizioni_corsi ic ON ic.corso_id = pcs.corso_id AND COALESCE(ic.attiva, true) = true
  JOIN public.atleti a ON a.id = ic.atleta_id
  WHERE pcs.id = p_planning_corso_id
  ORDER BY a.cognome, a.nome;
$$;

-- 8. Trigger trg_popola_destinatari
CREATE OR REPLACE FUNCTION public.popola_destinatari_comunicazione()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se la comunicazione è legata a un planning_corso_id, popola gli atleti iscritti al corso
  IF NEW.planning_corso_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, a.atleta_id
    FROM public.get_atleti_impattati_da_planning(NEW.planning_corso_id) a
    ON CONFLICT (comunicazione_id, atleta_id) DO NOTHING;
  -- Atleta singolo
  ELSIF NEW.atleta_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    VALUES (NEW.id, NEW.atleta_id)
    ON CONFLICT DO NOTHING;
  -- Tutti gli iscritti a un corso
  ELSIF NEW.corso_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, ic.atleta_id
    FROM public.iscrizioni_corsi ic
    WHERE ic.corso_id = NEW.corso_id AND COALESCE(ic.attiva, true) = true
    ON CONFLICT DO NOTHING;
  -- Tutti gli atleti del club
  ELSIF NEW.tipo_destinatari = 'tutti' THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, a.id FROM public.atleti a WHERE a.club_id = NEW.club_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_popola_destinatari ON public.comunicazioni;
CREATE TRIGGER trg_popola_destinatari
AFTER INSERT ON public.comunicazioni
FOR EACH ROW
EXECUTE FUNCTION public.popola_destinatari_comunicazione();

NOTIFY pgrst, 'reload schema';