-- 1) Tabella destinatari staff
CREATE TABLE IF NOT EXISTS public.comunicazioni_destinatari_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicazione_id uuid NOT NULL REFERENCES public.comunicazioni(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  club_id uuid NOT NULL,
  stato text NOT NULL DEFAULT 'pending',
  letto_at timestamptz NULL,
  archiviato_at timestamptz NULL,
  creato_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comunicazione_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_com_dest_staff_user ON public.comunicazioni_destinatari_staff(user_id, archiviato_at);
CREATE INDEX IF NOT EXISTS idx_com_dest_staff_club ON public.comunicazioni_destinatari_staff(club_id);
CREATE INDEX IF NOT EXISTS idx_com_dest_staff_com ON public.comunicazioni_destinatari_staff(comunicazione_id);

ALTER TABLE public.comunicazioni_destinatari_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON public.comunicazioni_destinatari_staff
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2) Estendi trigger popola_destinatari_comunicazione per gestire 'staff'
CREATE OR REPLACE FUNCTION public.popola_destinatari_comunicazione()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Caso STAFF: crea record in comunicazioni_destinatari_staff per ogni admin/staff del club
  IF NEW.tipo_destinatari = 'staff' THEN
    INSERT INTO public.comunicazioni_destinatari_staff (comunicazione_id, user_id, club_id)
    SELECT NEW.id, uc.user_id, NEW.club_id
    FROM public.utenti_club uc
    WHERE uc.club_id = NEW.club_id
      AND uc.ruolo IN ('admin', 'staff')
      AND uc.user_id IS NOT NULL
    ON CONFLICT (comunicazione_id, user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Comunicazione legata a un planning_corso_id
  IF NEW.planning_corso_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, a.atleta_id
    FROM public.get_atleti_impattati_da_planning(NEW.planning_corso_id) a
    ON CONFLICT (comunicazione_id, atleta_id) DO NOTHING;

  ELSIF NEW.atleti_ids IS NOT NULL AND array_length(NEW.atleti_ids, 1) > 0 THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, unnest(NEW.atleti_ids)
    ON CONFLICT DO NOTHING;

  ELSIF NEW.atleta_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    VALUES (NEW.id, NEW.atleta_id)
    ON CONFLICT DO NOTHING;

  ELSIF NEW.corsi_ids IS NOT NULL AND array_length(NEW.corsi_ids, 1) > 0 THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, ic.atleta_id
    FROM public.iscrizioni_corsi ic
    WHERE ic.corso_id = ANY(NEW.corsi_ids) AND COALESCE(ic.attiva, true) = true
    ON CONFLICT DO NOTHING;

  ELSIF NEW.corso_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, ic.atleta_id
    FROM public.iscrizioni_corsi ic
    WHERE ic.corso_id = NEW.corso_id AND COALESCE(ic.attiva, true) = true
    ON CONFLICT DO NOTHING;

  ELSIF NEW.livelli IS NOT NULL AND array_length(NEW.livelli, 1) > 0 THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, a.id
    FROM public.atleti a
    WHERE a.club_id = NEW.club_id
      AND (
        a.carriera_artistica = ANY(NEW.livelli)
        OR a.carriera_stile = ANY(NEW.livelli)
        OR a.livello_attuale = ANY(NEW.livelli)
      )
    ON CONFLICT DO NOTHING;

  ELSIF NEW.tipo_destinatari = 'tutti' THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, a.id FROM public.atleti a WHERE a.club_id = NEW.club_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Assicura che il trigger esista (potrebbe già esistere ma sicuriamoci)
DROP TRIGGER IF EXISTS trg_popola_destinatari_comunicazione ON public.comunicazioni;
CREATE TRIGGER trg_popola_destinatari_comunicazione
  AFTER INSERT ON public.comunicazioni
  FOR EACH ROW EXECUTE FUNCTION public.popola_destinatari_comunicazione();