-- 1. DROP overly permissive policies
DROP POLICY IF EXISTS "pacchetti_all_authenticated"   ON public.catalogo_pacchetti_opzionali;
DROP POLICY IF EXISTS "pacchetti_select_all"          ON public.catalogo_pacchetti_opzionali;
DROP POLICY IF EXISTS "iscr_pack_all_auth"            ON public.iscrizioni_pacchetti;
DROP POLICY IF EXISTS "sponsor_select_authenticated"  ON public.sponsor;
DROP POLICY IF EXISTS "sponsor_insert_authenticated"  ON public.sponsor;
DROP POLICY IF EXISTS "sponsor_update_authenticated"  ON public.sponsor;
DROP POLICY IF EXISTS "sponsor_delete_authenticated"  ON public.sponsor;
DROP POLICY IF EXISTS "rps_select_authenticated"      ON public.ruoli_permessi_sezioni;
DROP POLICY IF EXISTS "rps_insert_authenticated"      ON public.ruoli_permessi_sezioni;
DROP POLICY IF EXISTS "rps_update_authenticated"      ON public.ruoli_permessi_sezioni;
DROP POLICY IF EXISTS "rps_delete_authenticated"      ON public.ruoli_permessi_sezioni;
DROP POLICY IF EXISTS "dash_card_select_authenticated" ON public.dashboard_card_permessi;
DROP POLICY IF EXISTS "dash_card_insert_authenticated" ON public.dashboard_card_permessi;
DROP POLICY IF EXISTS "dash_card_update_authenticated" ON public.dashboard_card_permessi;
DROP POLICY IF EXISTS "dash_card_delete_authenticated" ON public.dashboard_card_permessi;
DROP POLICY IF EXISTS "f6_utenti_club_soft"           ON public.utenti_club;
DROP POLICY IF EXISTS "Authenticated can read all memberships" ON public.utenti_club;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_policies
    WHERE schemaname='public' AND policyname='f6_soft_all'
      AND qual LIKE '%auth.uid() IS NULL%'
    ORDER BY tablename
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS f6_soft_all ON public.%I', r.tablename);
    EXECUTE format($f$
      CREATE POLICY f6_soft_all ON public.%I
        AS PERMISSIVE FOR ALL TO authenticated
        USING (public.user_is_admin_like() OR (club_id = public.user_club_id()))
        WITH CHECK (public.user_is_admin_like() OR (club_id = public.user_club_id()))
    $f$, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE r record; new_qual text; new_check text;
BEGIN
  FOR r IN
    SELECT tablename, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND policyname='f6_child_soft'
      AND qual LIKE '%auth.uid() IS NULL%'
    ORDER BY tablename
  LOOP
    new_qual  := replace(r.qual, '(auth.uid() IS NULL) OR ', '');
    new_check := replace(COALESCE(r.with_check, r.qual), '(auth.uid() IS NULL) OR ', '');
    EXECUTE format('DROP POLICY IF EXISTS f6_child_soft ON public.%I', r.tablename);
    EXECUTE format(
      'CREATE POLICY f6_child_soft ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      r.tablename, new_qual, new_check
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS f6_clubs_soft ON public.clubs;
CREATE POLICY f6_clubs_soft ON public.clubs
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.user_is_admin_like() OR (id = public.user_club_id()))
  WITH CHECK (public.user_is_admin_like() OR (id = public.user_club_id()));

DROP POLICY IF EXISTS f6_soft_all ON public.iscrizioni_corsi;
CREATE POLICY f6_soft_all ON public.iscrizioni_corsi
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.atleti a
    WHERE a.id = iscrizioni_corsi.atleta_id AND a.club_id = public.user_club_id()))
  WITH CHECK (public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.atleti a
    WHERE a.id = iscrizioni_corsi.atleta_id AND a.club_id = public.user_club_id()));

DROP POLICY IF EXISTS f6_soft_all ON public.corsi_istruttori;
CREATE POLICY f6_soft_all ON public.corsi_istruttori
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.corsi c
    WHERE c.id = corsi_istruttori.corso_id AND c.club_id = public.user_club_id()))
  WITH CHECK (public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.corsi c
    WHERE c.id = corsi_istruttori.corso_id AND c.club_id = public.user_club_id()));

DROP POLICY IF EXISTS f6_soft_all ON public.planning_corsi_settimana;
CREATE POLICY f6_soft_all ON public.planning_corsi_settimana
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.planning_settimane ps
    WHERE ps.id = planning_corsi_settimana.settimana_id AND ps.club_id = public.user_club_id()))
  WITH CHECK (public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.planning_settimane ps
    WHERE ps.id = planning_corsi_settimana.settimana_id AND ps.club_id = public.user_club_id()));

DROP POLICY IF EXISTS f6_soft_all ON public.utenti_club;
DROP POLICY IF EXISTS utenti_club_select ON public.utenti_club;
DROP POLICY IF EXISTS utenti_club_insert ON public.utenti_club;
DROP POLICY IF EXISTS utenti_club_update ON public.utenti_club;
DROP POLICY IF EXISTS utenti_club_delete ON public.utenti_club;

CREATE POLICY utenti_club_select ON public.utenti_club
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.user_is_admin_like()
    OR club_id = public.user_club_id()
  );

CREATE POLICY utenti_club_insert ON public.utenti_club
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.user_is_admin_like());

CREATE POLICY utenti_club_update ON public.utenti_club
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.user_is_admin_like())
  WITH CHECK (public.user_is_admin_like());

CREATE POLICY utenti_club_delete ON public.utenti_club
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.user_is_admin_like());
