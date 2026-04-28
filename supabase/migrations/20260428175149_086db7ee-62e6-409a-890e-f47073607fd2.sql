-- Aggiungi colonne array per destinatari multipli
ALTER TABLE public.comunicazioni
  ADD COLUMN IF NOT EXISTS corsi_ids uuid[] NULL,
  ADD COLUMN IF NOT EXISTS atleti_ids uuid[] NULL,
  ADD COLUMN IF NOT EXISTS livelli text[] NULL;

-- Aggiorna funzione di popolamento destinatari per gestire i nuovi tipi
CREATE OR REPLACE FUNCTION public.popola_destinatari_comunicazione()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Comunicazione legata a un planning_corso_id: atleti iscritti al corso del planning
  IF NEW.planning_corso_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, a.atleta_id
    FROM public.get_atleti_impattati_da_planning(NEW.planning_corso_id) a
    ON CONFLICT (comunicazione_id, atleta_id) DO NOTHING;

  -- Lista esplicita di atleti (multi-select)
  ELSIF NEW.atleti_ids IS NOT NULL AND array_length(NEW.atleti_ids, 1) > 0 THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, unnest(NEW.atleti_ids)
    ON CONFLICT DO NOTHING;

  -- Atleta singolo (legacy)
  ELSIF NEW.atleta_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    VALUES (NEW.id, NEW.atleta_id)
    ON CONFLICT DO NOTHING;

  -- Lista di corsi (multi-select)
  ELSIF NEW.corsi_ids IS NOT NULL AND array_length(NEW.corsi_ids, 1) > 0 THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, ic.atleta_id
    FROM public.iscrizioni_corsi ic
    WHERE ic.corso_id = ANY(NEW.corsi_ids) AND COALESCE(ic.attiva, true) = true
    ON CONFLICT DO NOTHING;

  -- Corso singolo (legacy)
  ELSIF NEW.corso_id IS NOT NULL THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, ic.atleta_id
    FROM public.iscrizioni_corsi ic
    WHERE ic.corso_id = NEW.corso_id AND COALESCE(ic.attiva, true) = true
    ON CONFLICT DO NOTHING;

  -- Per livello: matcha su carriera_artistica/carriera_stile/livello_attuale
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

  -- Tutti gli atleti del club
  ELSIF NEW.tipo_destinatari = 'tutti' THEN
    INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id)
    SELECT NEW.id, a.id FROM public.atleti a WHERE a.club_id = NEW.club_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Assicura che il trigger sia attivo
DROP TRIGGER IF EXISTS trg_popola_destinatari_comunicazione ON public.comunicazioni;
CREATE TRIGGER trg_popola_destinatari_comunicazione
  AFTER INSERT ON public.comunicazioni
  FOR EACH ROW EXECUTE FUNCTION public.popola_destinatari_comunicazione();