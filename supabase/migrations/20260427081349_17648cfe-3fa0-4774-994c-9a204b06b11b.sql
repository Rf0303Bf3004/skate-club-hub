-- =====================================================================
-- Mobile parent access policies
-- Si attivano SOLO quando il JWT ha user_metadata.role = 'mobile_parent'
-- e leggono atleta_id / club_id da user_metadata.
-- Le policy "Allow all for authenticated" esistenti restano per admin.
-- =====================================================================

-- Helper: estrae claims mobile dal JWT corrente
CREATE OR REPLACE FUNCTION public.mobile_atleta_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    (auth.jwt() -> 'user_metadata' ->> 'atleta_id'),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.mobile_club_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    (auth.jwt() -> 'user_metadata' ->> 'club_id'),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_mobile_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') = 'mobile_parent';
$$;

-- =====================================================================
-- ATLETI: SELECT/UPDATE solo sul proprio atleta_id
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_atleti" ON public.atleti;
CREATE POLICY "mobile_parent_select_atleti"
  ON public.atleti
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND id = public.mobile_atleta_id()
  );

DROP POLICY IF EXISTS "mobile_parent_update_atleti" ON public.atleti;
CREATE POLICY "mobile_parent_update_atleti"
  ON public.atleti
  FOR UPDATE
  TO authenticated
  USING (
    public.is_mobile_parent() AND id = public.mobile_atleta_id()
  )
  WITH CHECK (
    public.is_mobile_parent() AND id = public.mobile_atleta_id()
  );

-- =====================================================================
-- FATTURE: SELECT della propria atleta
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_fatture" ON public.fatture;
CREATE POLICY "mobile_parent_select_fatture"
  ON public.fatture
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

-- =====================================================================
-- ISCRIZIONI CORSI
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_iscrizioni_corsi" ON public.iscrizioni_corsi;
CREATE POLICY "mobile_parent_select_iscrizioni_corsi"
  ON public.iscrizioni_corsi
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

-- =====================================================================
-- ISCRIZIONI GARE
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_iscrizioni_gare" ON public.iscrizioni_gare;
CREATE POLICY "mobile_parent_select_iscrizioni_gare"
  ON public.iscrizioni_gare
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

-- =====================================================================
-- LEZIONI PRIVATE: la atleta vede le lezioni a cui è iscritta
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_lezioni_private_atlete" ON public.lezioni_private_atlete;
CREATE POLICY "mobile_parent_select_lezioni_private_atlete"
  ON public.lezioni_private_atlete
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

DROP POLICY IF EXISTS "mobile_parent_select_lezioni_private" ON public.lezioni_private;
CREATE POLICY "mobile_parent_select_lezioni_private"
  ON public.lezioni_private
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND EXISTS (
      SELECT 1 FROM public.lezioni_private_atlete lpa
      WHERE lpa.lezione_id = lezioni_private.id
        AND lpa.atleta_id = public.mobile_atleta_id()
    )
  );

-- =====================================================================
-- PRESENZE
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_presenze" ON public.presenze;
CREATE POLICY "mobile_parent_select_presenze"
  ON public.presenze
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent()
    AND tipo_persona = 'atleta'
    AND persona_id = public.mobile_atleta_id()
  );

DROP POLICY IF EXISTS "mobile_parent_select_presenze_corso" ON public.presenze_corso;
CREATE POLICY "mobile_parent_select_presenze_corso"
  ON public.presenze_corso
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

-- =====================================================================
-- COMUNICAZIONI: del club + propri destinatari
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_comunicazioni" ON public.comunicazioni;
CREATE POLICY "mobile_parent_select_comunicazioni"
  ON public.comunicazioni
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND club_id = public.mobile_club_id()
  );

DROP POLICY IF EXISTS "mobile_parent_select_com_dest" ON public.comunicazioni_destinatari;
CREATE POLICY "mobile_parent_select_com_dest"
  ON public.comunicazioni_destinatari
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

DROP POLICY IF EXISTS "mobile_parent_update_com_dest" ON public.comunicazioni_destinatari;
CREATE POLICY "mobile_parent_update_com_dest"
  ON public.comunicazioni_destinatari
  FOR UPDATE
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  )
  WITH CHECK (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

-- =====================================================================
-- STORICO LIVELLI
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_storico_livelli" ON public.storico_livelli_atleta;
CREATE POLICY "mobile_parent_select_storico_livelli"
  ON public.storico_livelli_atleta
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

-- =====================================================================
-- ADESIONI
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_adesioni" ON public.adesioni_atleta;
CREATE POLICY "mobile_parent_select_adesioni"
  ON public.adesioni_atleta
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id()
  );

-- =====================================================================
-- CLUB / CORSI / GARE / EVENTI: lettura del proprio club
-- =====================================================================
DROP POLICY IF EXISTS "mobile_parent_select_clubs" ON public.clubs;
CREATE POLICY "mobile_parent_select_clubs"
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND id = public.mobile_club_id()
  );

DROP POLICY IF EXISTS "mobile_parent_select_corsi" ON public.corsi;
CREATE POLICY "mobile_parent_select_corsi"
  ON public.corsi
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND club_id = public.mobile_club_id()
  );

DROP POLICY IF EXISTS "mobile_parent_select_gare" ON public.gare_calendario;
CREATE POLICY "mobile_parent_select_gare"
  ON public.gare_calendario
  FOR SELECT
  TO authenticated
  USING (
    public.is_mobile_parent() AND club_id = public.mobile_club_id()
  );

-- =====================================================================
-- STORAGE: bucket foto-atleti
-- INSERT/UPDATE/DELETE solo se il path inizia con "<atleta_id>_"
-- e atleta_id corrisponde al claim del JWT.
-- SELECT resta pubblico (bucket public).
-- =====================================================================

-- Idempotenza: drop e ricrea
DROP POLICY IF EXISTS "mobile_parent_insert_foto_atleti" ON storage.objects;
CREATE POLICY "mobile_parent_insert_foto_atleti"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'foto-atleti'
    AND public.is_mobile_parent()
    AND name LIKE (public.mobile_atleta_id()::text || '_%')
  );

DROP POLICY IF EXISTS "mobile_parent_update_foto_atleti" ON storage.objects;
CREATE POLICY "mobile_parent_update_foto_atleti"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'foto-atleti'
    AND public.is_mobile_parent()
    AND name LIKE (public.mobile_atleta_id()::text || '_%')
  )
  WITH CHECK (
    bucket_id = 'foto-atleti'
    AND public.is_mobile_parent()
    AND name LIKE (public.mobile_atleta_id()::text || '_%')
  );

DROP POLICY IF EXISTS "mobile_parent_delete_foto_atleti" ON storage.objects;
CREATE POLICY "mobile_parent_delete_foto_atleti"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'foto-atleti'
    AND public.is_mobile_parent()
    AND name LIKE (public.mobile_atleta_id()::text || '_%')
  );
