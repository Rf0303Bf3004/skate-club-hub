
-- ==========================================
-- OPERAZIONE 1: NUKE — cancella tutti i dati
-- (tutte le tabelle public; gli utenti in auth.users non sono toccati)
-- ==========================================
TRUNCATE TABLE
  public.elementi_gara,
  public.risultati_gara,
  public.iscrizioni_gare,
  public.gare_calendario,
  public.iscrizioni_eventi,
  public.iscrizioni_eventi_campi,
  public.sessioni_campo,
  public.eventi_campi,
  public.iscrizioni_campo,
  public.campi_allenamento,
  public.eventi_straordinari,
  public.test_livello_atleti,
  public.test_livello,
  public.storico_livelli_atleta,
  public.adesioni_atleta,
  public.fatture,
  public.presenze_corso,
  public.presenze,
  public.comunicazioni_destinatari,
  public.comunicazioni,
  public.comunicazioni_template,
  public.lezioni_private_atlete,
  public.planning_private_settimana,
  public.planning_corsi_settimana,
  public.lezioni_private,
  public.iscrizioni_corsi,
  public.corsi_monitori,
  public.corsi_istruttori,
  public.richieste_iscrizione,
  public.corsi,
  public.tipi_corso,
  public.disponibilita_istruttori,
  public.disponibilita_ghiaccio,
  public.istruttori,
  public.inviti_genitori,
  public.device_tokens,
  public.atleti,
  public.impostazioni_planning,
  public.configurazione_ghiaccio,
  public.setup_club,
  public.planning_settimane,
  public.stagioni,
  public.clubs
RESTART IDENTITY CASCADE;

-- ==========================================
-- OPERAZIONE 2: MIGRAZIONE STRUTTURA atleti
-- ==========================================
ALTER TABLE public.atleti RENAME COLUMN percorso_amatori TO livello_attuale;
ALTER TABLE public.atleti ALTER COLUMN livello_attuale DROP DEFAULT;

ALTER TABLE public.atleti ADD COLUMN livello_in_preparazione text;

ALTER TABLE public.atleti DROP COLUMN luogo_nascita;

COMMENT ON COLUMN public.atleti.livello_attuale IS 'Livello tecnico attuale conseguito dall''atleta (Pulcini, Stellina 1-4, Interbronzo, Bronzo, Interargento, Argento, Interoro, Oro)';
COMMENT ON COLUMN public.atleti.livello_in_preparazione IS 'Livello tecnico che l''atleta sta attualmente preparando per il prossimo passaggio';
