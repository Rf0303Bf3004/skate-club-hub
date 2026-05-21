
-- F6 — Ruoli granulari end-to-end

-- 0) Rimuovi vincoli legacy
ALTER TABLE public.utenti_club DROP CONSTRAINT IF EXISTS utenti_club_ruolo_check;
ALTER TABLE public.utenti_club DROP CONSTRAINT IF EXISTS utenti_club_ruolo_chk;

-- 1) Migrazione dati staff->specifico
UPDATE public.utenti_club SET ruolo='presidente' WHERE ruolo='staff' AND nome ILIKE 'Presidente%';
UPDATE public.utenti_club SET ruolo='segreteria' WHERE ruolo='staff' AND nome ILIKE 'Segreteria%';
UPDATE public.utenti_club SET ruolo='dt'         WHERE ruolo='staff' AND (nome ILIKE 'DT%' OR cognome ILIKE 'DT%');
UPDATE public.utenti_club SET ruolo='istruttore' WHERE ruolo='staff' AND nome ILIKE 'Istruttore%';

-- 2) CHECK 7 valori
ALTER TABLE public.utenti_club ADD CONSTRAINT utenti_club_ruolo_chk
  CHECK (ruolo IN ('superadmin','admin','dt','segreteria','presidente','istruttore','aiuto_monitore'));

-- 3) Seed 2 nuove sezioni
INSERT INTO public.ruoli_permessi_sezioni (club_id, ruolo, codice_sezione, visibile)
SELECT c.id, x.ruolo, x.codice, x.visibile
FROM public.clubs c
CROSS JOIN (VALUES
  ('presidente','ore_lavorate',true),
  ('dt','ore_lavorate',true),
  ('segreteria','ore_lavorate',false),
  ('istruttore','ore_lavorate',true),
  ('aiuto_monitore','ore_lavorate',true),
  ('presidente','costi_istruttori',true),
  ('dt','costi_istruttori',true),
  ('segreteria','costi_istruttori',false),
  ('istruttore','costi_istruttori',false),
  ('aiuto_monitore','costi_istruttori',false)
) AS x(ruolo, codice, visibile)
ON CONFLICT (club_id, ruolo, codice_sezione) DO NOTHING;

-- 4) Correzione segreteria-gare
UPDATE public.ruoli_permessi_sezioni SET visibile=true
  WHERE ruolo='segreteria' AND codice_sezione='gare';

-- 5) Helper
CREATE OR REPLACE FUNCTION public.user_club_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT club_id FROM public.utenti_club WHERE user_id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.user_has_ruolo(_ruolo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.utenti_club WHERE user_id = auth.uid() AND ruolo = _ruolo);
$$;
CREATE OR REPLACE FUNCTION public.user_is_admin_like()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.utenti_club WHERE user_id = auth.uid() AND ruolo IN ('superadmin','admin'));
$$;

-- 6) RLS SOFT su tabelle con club_id diretto
DO $f6$
DECLARE
  v_tabella text;
  v_tabelle text[] := ARRAY[
    'atleti','istruttori','corsi','presenze',
    'ore_lavorate_dettaglio','ore_lavorate_istruttori',
    'comunicazioni','fatture','gare_calendario',
    'lezioni_private','planning_settimane',
    'regole_comunicazioni_club','ruoli_permessi_sezioni','dashboard_card_permessi'
  ];
BEGIN
  FOREACH v_tabella IN ARRAY v_tabelle LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabella);
    EXECUTE format('DROP POLICY IF EXISTS f6_soft_all ON public.%I;', v_tabella);
    EXECUTE format($p$
      CREATE POLICY f6_soft_all ON public.%I
      FOR ALL TO public
      USING (auth.uid() IS NULL OR public.user_is_admin_like() OR club_id = public.user_club_id())
      WITH CHECK (auth.uid() IS NULL OR public.user_is_admin_like() OR club_id = public.user_club_id());
    $p$, v_tabella);
  END LOOP;
END $f6$;

-- 7) Tabelle join (no club_id diretto): RLS soft permissiva, verranno strette in CLEANUP-02
DO $f6b$
DECLARE
  v_tabella text;
  v_tabelle text[] := ARRAY['planning_corsi_settimana','iscrizioni_corsi','corsi_istruttori'];
BEGIN
  FOREACH v_tabella IN ARRAY v_tabelle LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabella);
    EXECUTE format('DROP POLICY IF EXISTS f6_soft_all ON public.%I;', v_tabella);
    EXECUTE format($p$
      CREATE POLICY f6_soft_all ON public.%I
      FOR ALL TO public
      USING (true) WITH CHECK (true);
    $p$, v_tabella);
  END LOOP;
END $f6b$;

-- 8) utenti_club + clubs: permissiva sempre (necessaria per fetch_session)
ALTER TABLE public.utenti_club ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS f6_utenti_club_soft ON public.utenti_club;
CREATE POLICY f6_utenti_club_soft ON public.utenti_club
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS f6_clubs_soft ON public.clubs;
CREATE POLICY f6_clubs_soft ON public.clubs
  FOR ALL TO public USING (true) WITH CHECK (true);
