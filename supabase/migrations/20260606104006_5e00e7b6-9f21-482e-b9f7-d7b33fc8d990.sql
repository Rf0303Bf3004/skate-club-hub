
ALTER TABLE public.test_livello_atleti DROP CONSTRAINT IF EXISTS test_livello_atleti_disciplina_check;
ALTER TABLE public.test_livello_atleti
  ADD CONSTRAINT test_livello_atleti_disciplina_check
  CHECK (disciplina IS NULL OR disciplina IN ('artistica','stile','amatori'));

CREATE OR REPLACE FUNCTION public.trg_test_atleta_set_disciplina()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_categoria text;
BEGIN
  IF NEW.disciplina IS NULL OR NEW.disciplina = '' THEN
    SELECT categoria INTO v_categoria FROM public.atleti WHERE id = NEW.atleta_id;
    IF v_categoria IN ('amatori','artistica','stile') THEN
      NEW.disciplina := v_categoria;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_atleta_set_disciplina ON public.test_livello_atleti;
CREATE TRIGGER trg_test_atleta_set_disciplina
BEFORE INSERT ON public.test_livello_atleti
FOR EACH ROW EXECUTE FUNCTION public.trg_test_atleta_set_disciplina();

CREATE OR REPLACE FUNCTION public.trg_test_atleta_genera_comunicazione()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_club_id uuid;
  v_nome_test text;
  v_data_test date;
  v_nome text;
  v_cognome text;
BEGIN
  SELECT a.club_id, a.nome, a.cognome INTO v_club_id, v_nome, v_cognome
    FROM public.atleti a WHERE a.id = NEW.atleta_id;
  IF v_club_id IS NULL THEN RETURN NEW; END IF;

  SELECT t.nome, t.data INTO v_nome_test, v_data_test
    FROM public.test_livello t WHERE t.id = NEW.test_id;

  INSERT INTO public.comunicazioni
    (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
     atleta_id, test_livello_id, tipo_destinatari, urgente)
  VALUES
    (v_club_id,
     'Convocazione test ' || COALESCE(v_nome_test, 'livello'),
     '📋 ' || COALESCE(v_nome,'') || ' ' || COALESCE(v_cognome,'')
       || ' convocato/a al test "' || COALESCE(v_nome_test,'') || '"'
       || COALESCE(' del ' || to_char(v_data_test, 'DD/MM/YYYY'), '')
       || COALESCE(' — livello target: ' || NEW.livello_target, '') || '.',
     'convocazione', 'convocazione_test', 'inviata', 'sent',
     NEW.atleta_id, NEW.test_id, 'atleti', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_atleta_genera_comunicazione ON public.test_livello_atleti;
CREATE TRIGGER trg_test_atleta_genera_comunicazione
AFTER INSERT ON public.test_livello_atleti
FOR EACH ROW EXECUTE FUNCTION public.trg_test_atleta_genera_comunicazione();

-- Backfill Benedetta
UPDATE public.test_livello_atleti
SET disciplina = 'amatori'
WHERE atleta_id = '00030001-0000-0000-0000-000000000206'
  AND disciplina IS NULL
  AND esito = 'in_attesa';

INSERT INTO public.comunicazioni
  (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
   atleta_id, test_livello_id, tipo_destinatari, urgente)
SELECT
  a.club_id,
  'Convocazione test ' || COALESCE(t.nome, 'livello'),
  '📋 ' || a.nome || ' ' || a.cognome
    || ' convocato/a al test "' || COALESCE(t.nome,'') || '"'
    || COALESCE(' del ' || to_char(t.data, 'DD/MM/YYYY'), '')
    || COALESCE(' — livello target: ' || tla.livello_target, '') || '.',
  'convocazione', 'convocazione_test', 'inviata', 'sent',
  a.id, tla.test_id, 'atleti', true
FROM public.test_livello_atleti tla
JOIN public.atleti a ON a.id = tla.atleta_id
LEFT JOIN public.test_livello t ON t.id = tla.test_id
WHERE tla.atleta_id = '00030001-0000-0000-0000-000000000206'
  AND tla.esito = 'in_attesa'
  AND NOT EXISTS (
    SELECT 1 FROM public.comunicazioni c
    WHERE c.atleta_id = tla.atleta_id
      AND c.test_livello_id = tla.test_id
      AND c.sotto_tipo = 'convocazione_test'
  );
