-- Atleti: lettura pubblica solo se la riga ha un portal_token (l'utente deve conoscerlo per query efficace)
CREATE POLICY "Public read atleta by portal_token"
  ON public.atleti FOR SELECT
  TO anon
  USING (portal_token IS NOT NULL);

-- Clubs: lettura pubblica (info non sensibili: nome, logo, contatti vetrina)
CREATE POLICY "Public read clubs"
  ON public.clubs FOR SELECT
  TO anon
  USING (true);

-- Calendario: gare, eventi straordinari, lezioni private (e relazioni)
CREATE POLICY "Public read gare_calendario" ON public.gare_calendario FOR SELECT TO anon USING (true);
CREATE POLICY "Public read iscrizioni_gare"  ON public.iscrizioni_gare  FOR SELECT TO anon USING (true);
CREATE POLICY "Public read eventi_straordinari" ON public.eventi_straordinari FOR SELECT TO anon USING (true);
CREATE POLICY "Public read iscrizioni_eventi"   ON public.iscrizioni_eventi   FOR SELECT TO anon USING (true);
CREATE POLICY "Public read lezioni_private"        ON public.lezioni_private        FOR SELECT TO anon USING (true);
CREATE POLICY "Public read lezioni_private_atlete" ON public.lezioni_private_atlete FOR SELECT TO anon USING (true);

-- Comunicazioni e destinatari (il portale filtra per atleta_id derivato dal token)
CREATE POLICY "Public read comunicazioni"             ON public.comunicazioni             FOR SELECT TO anon USING (true);
CREATE POLICY "Public read comunicazioni_destinatari" ON public.comunicazioni_destinatari FOR SELECT TO anon USING (true);
-- Permette al portale di marcare RSVP / letto sui propri destinatari
CREATE POLICY "Public update comunicazioni_destinatari"
  ON public.comunicazioni_destinatari FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- Fatture: lettura pubblica (filtrata lato app per atleta_id)
CREATE POLICY "Public read fatture" ON public.fatture FOR SELECT TO anon USING (true);

-- Corsi e iscrizioni: per la sezione "Iscriviti"
CREATE POLICY "Public read corsi"            ON public.corsi            FOR SELECT TO anon USING (true);
CREATE POLICY "Public read iscrizioni_corsi" ON public.iscrizioni_corsi FOR SELECT TO anon USING (true);

-- Richieste iscrizione: lettura e inserimento dal portale
CREATE POLICY "Public read richieste_iscrizione"   ON public.richieste_iscrizione FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert richieste_iscrizione" ON public.richieste_iscrizione FOR INSERT TO anon WITH CHECK (true);