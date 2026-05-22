
-- 1. Add columns to clubs
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS sigla text,
  ADD COLUMN IF NOT EXISTS cantone text,
  ADD COLUMN IF NOT EXISTS attivo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completato boolean NOT NULL DEFAULT false;

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_cantone_chk;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_cantone_chk
  CHECK (cantone IS NULL OR cantone IN (
    'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW',
    'SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'
  ));

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_sigla_len_chk;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_sigla_len_chk
  CHECK (sigla IS NULL OR length(sigla) <= 10);

-- Backfill existing clubs
UPDATE public.clubs SET onboarding_completato = true WHERE onboarding_completato = false;

-- 2. Function: seed default permessi for a new club
CREATE OR REPLACE FUNCTION public.seed_permessi_default(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ruoli_permessi_sezioni WHERE club_id = p_club_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.ruoli_permessi_sezioni (club_id, ruolo, codice_sezione, visibile, ordine)
  VALUES
    -- admin / superadmin: nuove sezioni F6/F7
    (p_club_id, 'admin', 'pacchetti_sponsor', true, 0),
    (p_club_id, 'admin', 'pitch_pdf_generation', true, 0),
    (p_club_id, 'superadmin', 'pacchetti_sponsor', true, 0),
    (p_club_id, 'superadmin', 'pitch_pdf_generation', true, 0),
    -- presidente
    (p_club_id, 'presidente', 'dashboard', true, 0),
    (p_club_id, 'presidente', 'atleti', true, 0),
    (p_club_id, 'presidente', 'istruttori', true, 0),
    (p_club_id, 'presidente', 'corsi', true, 0),
    (p_club_id, 'presidente', 'gare', true, 0),
    (p_club_id, 'presidente', 'test_livello', true, 0),
    (p_club_id, 'presidente', 'lezioni_private', true, 0),
    (p_club_id, 'presidente', 'eventi', true, 0),
    (p_club_id, 'presidente', 'fatture', true, 0),
    (p_club_id, 'presidente', 'comunicazioni', true, 0),
    (p_club_id, 'presidente', 'stagioni', true, 0),
    (p_club_id, 'presidente', 'campi_allenamento', true, 0),
    (p_club_id, 'presidente', 'planning_ghiaccio', true, 0),
    (p_club_id, 'presidente', 'setup_club', true, 0),
    (p_club_id, 'presidente', 'gestione_avanzata', true, 0),
    (p_club_id, 'presidente', 'gestione_utenti', true, 0),
    (p_club_id, 'presidente', 'ruoli_permessi', true, 0),
    (p_club_id, 'presidente', 'import_dati', true, 0),
    (p_club_id, 'presidente', 'livelli', true, 0),
    (p_club_id, 'presidente', 'sponsor', true, 0),
    (p_club_id, 'presidente', 'pacchetti_sponsor', true, 0),
    (p_club_id, 'presidente', 'pitch_pdf_generation', true, 0),
    (p_club_id, 'presidente', 'ore_lavorate', true, 0),
    (p_club_id, 'presidente', 'costi_istruttori', true, 0),
    -- segreteria
    (p_club_id, 'segreteria', 'dashboard', true, 0),
    (p_club_id, 'segreteria', 'atleti', true, 0),
    (p_club_id, 'segreteria', 'istruttori', true, 0),
    (p_club_id, 'segreteria', 'corsi', true, 0),
    (p_club_id, 'segreteria', 'gare', true, 0),
    (p_club_id, 'segreteria', 'lezioni_private', true, 0),
    (p_club_id, 'segreteria', 'fatture', true, 0),
    (p_club_id, 'segreteria', 'comunicazioni', true, 0),
    (p_club_id, 'segreteria', 'import_dati', true, 0),
    -- dt
    (p_club_id, 'dt', 'dashboard', true, 0),
    (p_club_id, 'dt', 'atleti', true, 0),
    (p_club_id, 'dt', 'istruttori', true, 0),
    (p_club_id, 'dt', 'corsi', true, 0),
    (p_club_id, 'dt', 'gare', true, 0),
    (p_club_id, 'dt', 'test_livello', true, 0),
    (p_club_id, 'dt', 'lezioni_private', true, 0),
    (p_club_id, 'dt', 'eventi', true, 0),
    (p_club_id, 'dt', 'comunicazioni', true, 0),
    (p_club_id, 'dt', 'ore_lavorate', true, 0),
    (p_club_id, 'dt', 'costi_istruttori', true, 0),
    -- istruttore
    (p_club_id, 'istruttore', 'dashboard', true, 0),
    (p_club_id, 'istruttore', 'atleti', true, 0),
    (p_club_id, 'istruttore', 'corsi', true, 0),
    (p_club_id, 'istruttore', 'gare', true, 0),
    (p_club_id, 'istruttore', 'lezioni_private', true, 0),
    (p_club_id, 'istruttore', 'comunicazioni', true, 0),
    (p_club_id, 'istruttore', 'ore_lavorate', true, 0),
    -- aiuto_monitore
    (p_club_id, 'aiuto_monitore', 'atleti', true, 0),
    (p_club_id, 'aiuto_monitore', 'comunicazioni', true, 0),
    (p_club_id, 'aiuto_monitore', 'ore_lavorate', true, 0)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 3. Trigger: on INSERT clubs → seed pacchetti + permessi
CREATE OR REPLACE FUNCTION public.trg_seed_new_club()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_pacchetti_sponsor_default(NEW.id);
  PERFORM public.seed_permessi_default(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_new_club_aft_ins ON public.clubs;
CREATE TRIGGER trg_seed_new_club_aft_ins
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_new_club();
