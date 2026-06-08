-- Permetti accesso pubblico (anon) in lettura alle convenzioni attive
-- e ai cataloghi area/tipo, per supportare la pagina pubblica /c/:token.

GRANT SELECT ON public.convenzioni TO anon;
GRANT SELECT ON public.convenzioni_aree TO anon;
GRANT SELECT ON public.convenzioni_tipi_proposta TO anon;

-- Solo convenzioni attive sono visibili agli utenti non autenticati
DROP POLICY IF EXISTS "convenzioni_public_select_attive" ON public.convenzioni;
CREATE POLICY "convenzioni_public_select_attive"
  ON public.convenzioni FOR SELECT
  TO anon
  USING (stato = 'attiva');

-- Cataloghi: lettura libera per anon (servono per i join)
DROP POLICY IF EXISTS "convenzioni_aree_public_select" ON public.convenzioni_aree;
CREATE POLICY "convenzioni_aree_public_select"
  ON public.convenzioni_aree FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "convenzioni_tipi_proposta_public_select" ON public.convenzioni_tipi_proposta;
CREATE POLICY "convenzioni_tipi_proposta_public_select"
  ON public.convenzioni_tipi_proposta FOR SELECT
  TO anon
  USING (true);
