
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN (SELECT tablename FROM pg_policies WHERE schemaname='public' AND policyname='Allow all for authenticated')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I;', t);
    END LOOP;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN (
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='club_id'
      AND tb.table_type='BASE TABLE'
      AND c.table_name <> 'clubs'
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.table_name AND p.policyname='f6_soft_all')
  )
  LOOP
    EXECUTE format($f$
      CREATE POLICY "f6_soft_all" ON public.%I
      AS PERMISSIVE FOR ALL TO public
      USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR (club_id = public.user_club_id()))
      WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR (club_id = public.user_club_id()))
    $f$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "f6_clubs_soft" ON public.clubs;
CREATE POLICY "f6_clubs_soft" ON public.clubs
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR (id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR (id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.corsi_monitori;
CREATE POLICY "f6_child_soft" ON public.corsi_monitori
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.corsi c WHERE c.id = corsi_monitori.corso_id AND c.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.corsi c WHERE c.id = corsi_monitori.corso_id AND c.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.comunicazioni_destinatari;
CREATE POLICY "f6_child_soft" ON public.comunicazioni_destinatari
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.comunicazioni c WHERE c.id = comunicazioni_destinatari.comunicazione_id AND c.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.comunicazioni c WHERE c.id = comunicazioni_destinatari.comunicazione_id AND c.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.iscrizioni_campo;
CREATE POLICY "f6_child_soft" ON public.iscrizioni_campo
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.campi_allenamento p WHERE p.id = iscrizioni_campo.campo_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.campi_allenamento p WHERE p.id = iscrizioni_campo.campo_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.iscrizioni_eventi;
CREATE POLICY "f6_child_soft" ON public.iscrizioni_eventi
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_pubblici p WHERE p.id = iscrizioni_eventi.evento_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_pubblici p WHERE p.id = iscrizioni_eventi.evento_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.iscrizioni_eventi_campi;
CREATE POLICY "f6_child_soft" ON public.iscrizioni_eventi_campi
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_campi p WHERE p.id = iscrizioni_eventi_campi.evento_campo_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_campi p WHERE p.id = iscrizioni_eventi_campi.evento_campo_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.iscrizioni_eventi_esterni;
CREATE POLICY "f6_child_soft" ON public.iscrizioni_eventi_esterni
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_esterni p WHERE p.id = iscrizioni_eventi_esterni.evento_esterno_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_esterni p WHERE p.id = iscrizioni_eventi_esterni.evento_esterno_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.iscrizioni_gare;
CREATE POLICY "f6_child_soft" ON public.iscrizioni_gare
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.gare_calendario p WHERE p.id = iscrizioni_gare.gara_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.gare_calendario p WHERE p.id = iscrizioni_gare.gara_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.risultati_gara;
CREATE POLICY "f6_child_soft" ON public.risultati_gara
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.gare_calendario g WHERE g.id = risultati_gara.gara_id AND g.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.gare_calendario g WHERE g.id = risultati_gara.gara_id AND g.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.elementi_gara;
CREATE POLICY "f6_child_soft" ON public.elementi_gara
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.risultati_gara r JOIN public.gare_calendario g ON g.id = r.gara_id
    WHERE r.id = elementi_gara.risultato_id AND g.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (
    SELECT 1 FROM public.risultati_gara r JOIN public.gare_calendario g ON g.id = r.gara_id
    WHERE r.id = elementi_gara.risultato_id AND g.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.lezioni_private_atlete;
CREATE POLICY "f6_child_soft" ON public.lezioni_private_atlete
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.lezioni_private p WHERE p.id = lezioni_private_atlete.lezione_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.lezioni_private p WHERE p.id = lezioni_private_atlete.lezione_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.planning_private_settimana;
CREATE POLICY "f6_child_soft" ON public.planning_private_settimana
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.lezioni_private p WHERE p.id = planning_private_settimana.lezione_privata_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.lezioni_private p WHERE p.id = planning_private_settimana.lezione_privata_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.presenze_corso;
CREATE POLICY "f6_child_soft" ON public.presenze_corso
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = presenze_corso.atleta_id AND a.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = presenze_corso.atleta_id AND a.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.sessioni_campo;
CREATE POLICY "f6_child_soft" ON public.sessioni_campo
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_campi p WHERE p.id = sessioni_campo.evento_campo_id AND p.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.eventi_campi p WHERE p.id = sessioni_campo.evento_campo_id AND p.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.storico_livelli_atleta;
CREATE POLICY "f6_child_soft" ON public.storico_livelli_atleta
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = storico_livelli_atleta.atleta_id AND a.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = storico_livelli_atleta.atleta_id AND a.club_id = public.user_club_id()));

DROP POLICY IF EXISTS "f6_child_soft" ON public.test_livello_atleti;
CREATE POLICY "f6_child_soft" ON public.test_livello_atleti
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = test_livello_atleti.atleta_id AND a.club_id = public.user_club_id()))
  WITH CHECK ((auth.uid() IS NULL) OR public.user_is_admin_like() OR EXISTS (SELECT 1 FROM public.atleti a WHERE a.id = test_livello_atleti.atleta_id AND a.club_id = public.user_club_id()));
