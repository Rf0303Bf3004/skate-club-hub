
-- 1) richieste_iscrizione: drop anon SELECT/INSERT
DROP POLICY IF EXISTS "Public read richieste_iscrizione" ON public.richieste_iscrizione;
DROP POLICY IF EXISTS "Public insert richieste_iscrizione" ON public.richieste_iscrizione;

-- 2) iscrizioni_* drop anon SELECT
DROP POLICY IF EXISTS "Public read iscrizioni_corsi" ON public.iscrizioni_corsi;
DROP POLICY IF EXISTS "Public read iscrizioni_gare" ON public.iscrizioni_gare;
DROP POLICY IF EXISTS "Public read iscrizioni_eventi" ON public.iscrizioni_eventi;
DROP POLICY IF EXISTS "Public read iscrizioni_eventi_esterni" ON public.iscrizioni_eventi_esterni;

-- 3) iscrizioni_pacchetti: drop public SELECT
DROP POLICY IF EXISTS "iscr_pack_select" ON public.iscrizioni_pacchetti;

-- 4) inviti_genitori: restrict to same club staff
DROP POLICY IF EXISTS "inviti_genitori_authenticated_all" ON public.inviti_genitori;

CREATE POLICY "inviti_genitori_same_club"
  ON public.inviti_genitori
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utenti_club uc
      WHERE uc.user_id = auth.uid()
        AND uc.club_id = inviti_genitori.club_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utenti_club uc
      WHERE uc.user_id = auth.uid()
        AND uc.club_id = inviti_genitori.club_id
    )
  );

-- 5) device_tokens: restrict to owner / mobile parent
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.device_tokens;

CREATE POLICY "device_tokens_owner_select"
  ON public.device_tokens FOR SELECT TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id())
  );

CREATE POLICY "device_tokens_owner_insert"
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id())
  );

CREATE POLICY "device_tokens_owner_update"
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id())
  )
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id())
  );

CREATE POLICY "device_tokens_owner_delete"
  ON public.device_tokens FOR DELETE TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (public.is_mobile_parent() AND atleta_id = public.mobile_atleta_id())
  );

-- 6) livelli: enable RLS + public read
ALTER TABLE public.livelli ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "livelli_public_read" ON public.livelli;
CREATE POLICY "livelli_public_read"
  ON public.livelli FOR SELECT
  TO anon, authenticated
  USING (true);
