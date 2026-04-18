-- Rimuovi eventuali duplicati esistenti prima di creare il vincolo
DELETE FROM public.comunicazioni_destinatari a
USING public.comunicazioni_destinatari b
WHERE a.id < b.id
  AND a.comunicazione_id = b.comunicazione_id
  AND a.atleta_id = b.atleta_id;

-- Aggiungi UNIQUE constraint richiesto dall'ON CONFLICT del trigger popola_destinatari_comunicazione
ALTER TABLE public.comunicazioni_destinatari
  ADD CONSTRAINT comunicazioni_destinatari_unique_pair UNIQUE (comunicazione_id, atleta_id);