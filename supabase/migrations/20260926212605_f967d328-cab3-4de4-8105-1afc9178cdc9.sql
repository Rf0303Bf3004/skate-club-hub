CREATE OR REPLACE FUNCTION public.trg_atleta_livello_coerente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Una casella di livello che non appartiene alla categoria attuale viene
  -- svuotata. Il passato resta nello storico livelli (storico_livelli_atleta),
  -- non nella casella: un residuo qui veniva letto come livello vero.
  -- Va PRIMA del riempimento, che altrimenti potrebbe riscrivere cio che si svuota.
  IF NEW.categoria = 'artistica' THEN
    NEW.livello_amatori := NULL;
  ELSIF NEW.categoria IN ('amatori','pulcini') THEN
    NEW.livello_artistica := NULL;
    NEW.livello_stile := NULL;
  END IF;

  -- Il livello si puo scrivere in due posti: il campo per categoria (nuovo, su cui
  -- si reggono regole, test e promozioni) e livello_attuale (vecchio, di ripiego,
  -- usato solo per mostrare). Chi scrive solo il vecchio crea un'atleta che a
  -- schermo ha un livello e per le regole non ne ha: un vuoto che sembra un dato.
  -- Qui si riempie SOLO cio che e vuoto: nessun valore scritto a mano viene mai
  -- sovrascritto, quindi il trigger non puo cambiare una decisione del club.

  IF NEW.categoria = 'amatori' THEN
    IF nullif(btrim(coalesce(NEW.livello_amatori,'')),'') IS NULL
       AND nullif(btrim(coalesce(NEW.livello_attuale,'')),'') IS NOT NULL THEN
      NEW.livello_amatori := NEW.livello_attuale;
    END IF;
  ELSIF NEW.categoria = 'artistica' THEN
    IF nullif(btrim(coalesce(NEW.livello_artistica,'')),'') IS NULL
       AND nullif(btrim(coalesce(NEW.livello_attuale,'')),'') IS NOT NULL THEN
      NEW.livello_artistica := NEW.livello_attuale;
    END IF;
  END IF;

  -- Direzione opposta: chi scrive solo il campo nuovo non deve far sparire il
  -- livello a chi legge ancora quello vecchio.
  IF nullif(btrim(coalesce(NEW.livello_attuale,'')),'') IS NULL THEN
    NEW.livello_attuale := coalesce(
      nullif(btrim(coalesce(NEW.livello_artistica,'')),''),
      nullif(btrim(coalesce(NEW.livello_amatori,'')),'')
    );
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_atleta_livello_coerente ON public.atleti;
CREATE TRIGGER trg_atleta_livello_coerente
  BEFORE INSERT OR UPDATE OF categoria, livello_attuale, livello_amatori, livello_artistica, livello_stile
  ON public.atleti FOR EACH ROW EXECUTE FUNCTION public.trg_atleta_livello_coerente();