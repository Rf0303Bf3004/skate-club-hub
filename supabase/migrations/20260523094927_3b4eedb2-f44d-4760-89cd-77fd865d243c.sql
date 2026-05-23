CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS atleti_search_trgm
  ON public.atleti USING gin ((lower(coalesce(nome,'') || ' ' || coalesce(cognome,'') || ' ' || coalesce(codice_atleta,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS atleti_email_genitori_trgm
  ON public.atleti USING gin ((lower(coalesce(genitore1_email,'') || ' ' || coalesce(genitore2_email,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS comunicazioni_search_trgm
  ON public.comunicazioni USING gin ((lower(coalesce(titolo,'') || ' ' || coalesce(testo,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS fatture_search_trgm
  ON public.fatture USING gin ((lower(coalesce(numero,'') || ' ' || coalesce(descrizione,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS gare_search_trgm
  ON public.gare_calendario USING gin ((lower(coalesce(nome,'') || ' ' || coalesce(luogo,'') || ' ' || coalesce(club_ospitante,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS eventi_str_search_trgm
  ON public.eventi_straordinari USING gin ((lower(coalesce(titolo,'') || ' ' || coalesce(descrizione,'') || ' ' || coalesce(luogo,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS istruttori_search_trgm
  ON public.istruttori USING gin ((lower(coalesce(nome,'') || ' ' || coalesce(cognome,'') || ' ' || coalesce(email,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS sponsor_search_trgm
  ON public.sponsor USING gin ((lower(coalesce(nome,'') || ' ' || coalesce(categoria,''))) gin_trgm_ops);