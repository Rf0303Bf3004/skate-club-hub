ALTER TABLE public.istruttori
  ADD COLUMN IF NOT EXISTS qualifica_gs text NOT NULL DEFAULT 'nessuna',
  ADD COLUMN IF NOT EXISTS numero_gs text NULL,
  ADD COLUMN IF NOT EXISTS gs_valido_fino date NULL,
  ADD COLUMN IF NOT EXISTS data_nascita date NULL;

ALTER TABLE public.istruttori
  ADD CONSTRAINT istruttori_qualifica_gs_chk
  CHECK (qualifica_gs IN ('nessuna', 'monitore_gs', 'coach_1418'));

COMMENT ON COLUMN public.istruttori.qualifica_gs IS 'Qualifica Gioventù e Sport della persona: nessuna = nessuna qualifica; monitore_gs = monitore G+S riconosciuto; coach_1418 = 1418coach, programma cantonale per aiuto-monitori 14-18 anni, propedeutico a G+S.';
COMMENT ON COLUMN public.istruttori.numero_gs IS 'Numero di riconoscimento G+S (o 1418coach) rilasciato alla persona. Vuoto se non ha qualifica.';
COMMENT ON COLUMN public.istruttori.gs_valido_fino IS 'Data di scadenza del riconoscimento G+S: oltre questa data la qualifica va rinnovata con un corso di aggiornamento.';
COMMENT ON COLUMN public.istruttori.data_nascita IS 'Data di nascita della persona: serve a verificare l''età minima (17 anni per anno civile) richiesta dalla formazione base di monitore G+S.';