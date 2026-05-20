-- 1. Tabella regole configurabili
CREATE TABLE IF NOT EXISTS public.regole_comunicazioni_club (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  codice text NOT NULL,
  attiva boolean NOT NULL DEFAULT true,
  parametri jsonb NOT NULL DEFAULT '{}'::jsonb,
  destinatario_notifica text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, codice)
);

ALTER TABLE public.regole_comunicazioni_club ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.regole_comunicazioni_club;
CREATE POLICY "Allow all for authenticated" ON public.regole_comunicazioni_club
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_regole_com_updated_at
  BEFORE UPDATE ON public.regole_comunicazioni_club
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Flag a_rischio su atleti
ALTER TABLE public.atleti
  ADD COLUMN IF NOT EXISTS a_rischio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS a_rischio_da timestamptz;

-- 3. Trigger assenze ripetute
CREATE OR REPLACE FUNCTION public.trg_check_assenze_ripetute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regola RECORD;
  v_soglia int;
  v_assenze_consec int;
  v_atleta RECORD;
BEGIN
  IF NEW.tipo_persona IS DISTINCT FROM 'atleta' THEN RETURN NEW; END IF;
  IF NEW.metodo NOT IN ('assente','dichiarata_no','assenza') THEN RETURN NEW; END IF;

  SELECT * INTO v_regola FROM public.regole_comunicazioni_club
   WHERE club_id = NEW.club_id AND codice = 'assenze_ripetute' AND attiva = true;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_soglia := COALESCE((v_regola.parametri->>'soglia_consecutive')::int, 3);

  SELECT COUNT(*) INTO v_assenze_consec FROM (
    SELECT metodo FROM public.presenze
     WHERE persona_id = NEW.persona_id AND tipo_persona='atleta' AND club_id = NEW.club_id
     ORDER BY data DESC
     LIMIT v_soglia
  ) recent
  WHERE metodo IN ('assente','dichiarata_no','assenza');

  IF v_assenze_consec >= v_soglia THEN
    SELECT id, nome, cognome, a_rischio INTO v_atleta FROM public.atleti WHERE id = NEW.persona_id;
    IF v_atleta.a_rischio IS NOT TRUE THEN
      UPDATE public.atleti SET a_rischio = true, a_rischio_da = now() WHERE id = NEW.persona_id;
      INSERT INTO public.comunicazioni
        (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
         atleta_id, tipo_destinatari, urgente)
      VALUES (NEW.club_id,
        '⚠️ Atleta a rischio',
        '⚠️ ' || COALESCE(v_atleta.nome,'') || ' ' || COALESCE(v_atleta.cognome,'')
          || ' ha ' || v_assenze_consec || ' assenze consecutive',
        'alert_regola', 'assenze_ripetute', 'ricevuta', 'sent',
        v_atleta.id, 'staff', true);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_presenze_check_rischio ON public.presenze;
CREATE TRIGGER trg_presenze_check_rischio
  AFTER INSERT ON public.presenze
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_assenze_ripetute();

-- 4. Trigger suggerisci sostituti su rifiuto staff
CREATE OR REPLACE FUNCTION public.trg_suggerisci_sostituti_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_com RECORD;
  v_pcs RECORD;
  v_regola RECORD;
  v_sostituti text;
BEGIN
  IF NEW.rsvp_risposta IS DISTINCT FROM 'no' THEN RETURN NEW; END IF;
  IF OLD.rsvp_risposta IS NOT DISTINCT FROM 'no' THEN RETURN NEW; END IF;

  SELECT c.club_id, c.sotto_tipo, c.planning_corso_id, c.data_evento
    INTO v_com FROM public.comunicazioni c WHERE c.id = NEW.comunicazione_id;
  IF v_com.sotto_tipo IS DISTINCT FROM 'reminder_staff' THEN RETURN NEW; END IF;

  SELECT * INTO v_regola FROM public.regole_comunicazioni_club
   WHERE club_id = v_com.club_id AND codice = 'rifiuto_staff' AND attiva = true;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT pcs.ora_inizio, c.nome AS corso_nome
    INTO v_pcs
    FROM public.planning_corsi_settimana pcs
    JOIN public.corsi c ON c.id = pcs.corso_id
   WHERE pcs.id = v_com.planning_corso_id;

  WITH media AS (
    SELECT AVG(ore_corsi) AS avg_ore
      FROM public.ore_lavorate_istruttori
     WHERE club_id = v_com.club_id
       AND anno = EXTRACT(YEAR FROM v_com.data_evento)::int
       AND mese = EXTRACT(MONTH FROM v_com.data_evento)::int
  ),
  candidati AS (
    SELECT i.id, i.nome, i.cognome,
           COALESCE(o.ore_corsi, 0) AS ore,
           (SELECT avg_ore FROM media) AS media_ore
      FROM public.istruttori i
      LEFT JOIN public.ore_lavorate_istruttori o
        ON o.istruttore_id = i.id
       AND o.anno = EXTRACT(YEAR FROM v_com.data_evento)::int
       AND o.mese = EXTRACT(MONTH FROM v_com.data_evento)::int
     WHERE i.club_id = v_com.club_id
       AND COALESCE(i.attivo, true) = true
       AND i.stato_staff = 'attivo'
  ),
  top3 AS (
    SELECT nome, cognome, ore, media_ore
      FROM candidati
     ORDER BY CASE WHEN media_ore IS NOT NULL AND ore < media_ore THEN 0 ELSE 1 END,
              random()
     LIMIT 3
  )
  SELECT string_agg(nome || ' ' || cognome || ' (' || ROUND(ore,1) || 'h)', ', ')
    INTO v_sostituti FROM top3;

  INSERT INTO public.comunicazioni
    (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
     planning_corso_id, data_evento, tipo_destinatari, urgente)
  VALUES (v_com.club_id,
    '🔄 Suggerimento sostituti staff',
    '🔄 Sostituti suggeriti per ' || COALESCE(v_pcs.corso_nome,'corso') || ' del '
      || to_char(v_com.data_evento,'DD/MM') || ' '
      || COALESCE(to_char(v_pcs.ora_inizio,'HH24:MI'),'') || ': '
      || COALESCE(v_sostituti, 'nessun candidato disponibile'),
    'alert_regola', 'sostituzione_staff', 'ricevuta', 'sent',
    v_com.planning_corso_id, v_com.data_evento, 'staff', true);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_staff_rifiuto_sostituti ON public.comunicazioni_destinatari_staff;
CREATE TRIGGER trg_staff_rifiuto_sostituti
  AFTER UPDATE ON public.comunicazioni_destinatari_staff
  FOR EACH ROW EXECUTE FUNCTION public.trg_suggerisci_sostituti_staff();

-- 5. Cron settimanale saturazione corsi
CREATE OR REPLACE FUNCTION public.controlla_saturazione_corsi()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regola RECORD;
  v_soglia numeric;
  v_corso RECORD;
  v_data_da date;
  v_data_a date;
  v_total int := 0;
BEGIN
  v_data_a := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_data_da := v_data_a - 7;

  FOR v_regola IN
    SELECT * FROM public.regole_comunicazioni_club
     WHERE codice = 'saturazione_bassa' AND attiva = true
  LOOP
    v_soglia := COALESCE((v_regola.parametri->>'soglia_percentuale')::numeric, 50);

    FOR v_corso IN
      WITH iscr AS (
        SELECT corso_id, COUNT(*) AS n_iscritti
          FROM public.iscrizioni_corsi
         WHERE COALESCE(attiva,true)=true
         GROUP BY corso_id
      ),
      pres AS (
        SELECT pcs.corso_id,
               COUNT(*) FILTER (WHERE p.metodo IN ('presente','nfc')) AS n_pres,
               COUNT(DISTINCT pcs.id) AS n_sess
          FROM public.planning_corsi_settimana pcs
          LEFT JOIN public.presenze p
            ON p.tipo_riferimento='planning_corso' AND p.riferimento_id = pcs.id
         WHERE pcs.data BETWEEN v_data_da AND v_data_a
           AND COALESCE(pcs.annullato,false)=false
         GROUP BY pcs.corso_id
      )
      SELECT c.id, c.nome, c.club_id, iscr.n_iscritti, pres.n_pres, pres.n_sess,
             CASE WHEN iscr.n_iscritti * pres.n_sess > 0
                  THEN (pres.n_pres::numeric / (iscr.n_iscritti * pres.n_sess) * 100)
                  ELSE NULL END AS saturazione
        FROM public.corsi c
        JOIN iscr ON iscr.corso_id = c.id
        JOIN pres ON pres.corso_id = c.id
       WHERE c.club_id = v_regola.club_id
         AND iscr.n_iscritti > 0 AND pres.n_sess > 0
    LOOP
      IF v_corso.saturazione IS NOT NULL AND v_corso.saturazione < v_soglia THEN
        INSERT INTO public.comunicazioni
          (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
           corso_id, tipo_destinatari, urgente)
        VALUES (v_corso.club_id,
          '📉 Saturazione bassa: ' || v_corso.nome,
          '📉 Corso ' || v_corso.nome || ' ha saturazione '
            || ROUND(v_corso.saturazione,1) || '% (soglia ' || v_soglia
            || '%) negli ultimi 7 giorni — ' || v_corso.n_pres
            || ' presenze su ' || v_corso.n_iscritti || ' iscritti × ' || v_corso.n_sess || ' sessioni',
          'alert_regola', 'saturazione_bassa', 'ricevuta', 'sent',
          v_corso.id, 'staff', false);
        v_total := v_total + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_total;
END $$;

-- Schedule cron (rimuove eventuali job preesistenti con stesso nome)
DO $$
BEGIN
  PERFORM cron.unschedule('controlla-saturazione-corsi-settimanale');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'controlla-saturazione-corsi-settimanale',
  '0 8 * * 1',
  $cron$SELECT public.controlla_saturazione_corsi();$cron$
);

-- 6. Seed regole default per ogni club esistente
INSERT INTO public.regole_comunicazioni_club (club_id, codice, attiva, parametri, destinatario_notifica)
SELECT id, 'assenze_ripetute', true, '{"soglia_consecutive":3}'::jsonb, 'admin' FROM public.clubs
ON CONFLICT (club_id, codice) DO NOTHING;

INSERT INTO public.regole_comunicazioni_club (club_id, codice, attiva, parametri, destinatario_notifica)
SELECT id, 'rifiuto_staff', true, '{}'::jsonb, 'admin' FROM public.clubs
ON CONFLICT (club_id, codice) DO NOTHING;

INSERT INTO public.regole_comunicazioni_club (club_id, codice, attiva, parametri, destinatario_notifica)
SELECT id, 'saturazione_bassa', true, '{"soglia_percentuale":50}'::jsonb, 'admin' FROM public.clubs
ON CONFLICT (club_id, codice) DO NOTHING;