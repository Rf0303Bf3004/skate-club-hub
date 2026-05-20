
ALTER TABLE public.comunicazioni
  ADD COLUMN IF NOT EXISTS sotto_tipo text,
  ADD COLUMN IF NOT EXISTS data_evento date;

CREATE INDEX IF NOT EXISTS idx_comunicazioni_sotto_tipo ON public.comunicazioni(sotto_tipo) WHERE sotto_tipo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comunicazioni_data_evento ON public.comunicazioni(data_evento) WHERE data_evento IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_allenamento
  ON public.comunicazioni(sotto_tipo, atleta_id, planning_corso_id, data_evento)
  WHERE sotto_tipo = 'reminder_allenamento';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_staff
  ON public.comunicazioni(sotto_tipo, planning_corso_id, data_evento)
  WHERE sotto_tipo = 'reminder_staff';

ALTER TABLE public.comunicazioni_destinatari_staff
  ADD COLUMN IF NOT EXISTS rsvp_risposta text,
  ADD COLUMN IF NOT EXISTS rsvp_at timestamptz;

ALTER TABLE public.comunicazioni_destinatari_staff
  DROP CONSTRAINT IF EXISTS cds_rsvp_risposta_check;
ALTER TABLE public.comunicazioni_destinatari_staff
  ADD CONSTRAINT cds_rsvp_risposta_check CHECK (rsvp_risposta IS NULL OR rsvp_risposta IN ('si','no'));

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS reminder_allenamenti_attivo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_staff_attivo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_orario_invio int NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS reminder_anticipo_giorni int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reminder_last_run_date date;

ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_reminder_orario_check;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_reminder_orario_check CHECK (reminder_orario_invio BETWEEN 16 AND 20);

ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_reminder_anticipo_check;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_reminder_anticipo_check CHECK (reminder_anticipo_giorni IN (1,2));

CREATE OR REPLACE FUNCTION public.genera_reminder_giornalieri()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club RECORD;
  v_data_target date;
  v_hour_zh int;
  v_today_zh date;
  v_pcs RECORD;
  v_atleta RECORD;
  v_istr_user uuid;
  v_istr_record RECORD;
  v_mon RECORD;
  v_com_id uuid;
  v_total int := 0;
BEGIN
  v_hour_zh := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Zurich'))::int;
  v_today_zh := (now() AT TIME ZONE 'Europe/Zurich')::date;

  FOR v_club IN
    SELECT id, reminder_allenamenti_attivo, reminder_staff_attivo,
           reminder_orario_invio, reminder_anticipo_giorni, reminder_last_run_date
      FROM public.clubs
     WHERE reminder_orario_invio = v_hour_zh
       AND (reminder_last_run_date IS NULL OR reminder_last_run_date < v_today_zh)
       AND (reminder_allenamenti_attivo OR reminder_staff_attivo)
  LOOP
    v_data_target := v_today_zh + v_club.reminder_anticipo_giorni;

    FOR v_pcs IN
      SELECT pcs.id AS planning_id, pcs.corso_id, pcs.data, pcs.ora_inizio,
             pcs.istruttore_id, c.nome AS corso_nome
        FROM public.planning_corsi_settimana pcs
        JOIN public.corsi c ON c.id = pcs.corso_id
        JOIN public.planning_settimane ps ON ps.id = pcs.settimana_id
       WHERE pcs.data = v_data_target
         AND COALESCE(pcs.annullato, false) = false
         AND ps.club_id = v_club.id
    LOOP

      IF v_club.reminder_allenamenti_attivo THEN
        FOR v_atleta IN
          SELECT a.id, a.nome
            FROM public.iscrizioni_corsi ic
            JOIN public.atleti a ON a.id = ic.atleta_id
           WHERE ic.corso_id = v_pcs.corso_id
             AND COALESCE(ic.attiva, true) = true
             AND a.club_id = v_club.id
        LOOP
          v_com_id := NULL;
          INSERT INTO public.comunicazioni
            (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
             atleta_id, planning_corso_id, data_evento, richiede_rsvp, tipo_destinatari)
          VALUES
            (v_club.id,
             'Reminder allenamento ' || to_char(v_pcs.data, 'DD/MM'),
             '🔔 Ciao ' || v_atleta.nome || ', domani ' || to_char(v_pcs.ora_inizio, 'HH24:MI')
               || ' hai allenamento ' || v_pcs.corso_nome || ' in pista. Confermi la presenza?',
             'reminder', 'reminder_allenamento', 'inviata', 'sent',
             v_atleta.id, v_pcs.planning_id, v_pcs.data, true, 'atleti')
          ON CONFLICT DO NOTHING
          RETURNING id INTO v_com_id;

          IF v_com_id IS NOT NULL THEN
            INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id, stato)
            VALUES (v_com_id, v_atleta.id, 'pending')
            ON CONFLICT DO NOTHING;
            v_total := v_total + 1;
          END IF;
        END LOOP;
      END IF;

      IF v_club.reminder_staff_attivo THEN
        v_com_id := NULL;
        INSERT INTO public.comunicazioni
          (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
           planning_corso_id, data_evento, richiede_rsvp, tipo_destinatari, urgente)
        VALUES
          (v_club.id,
           '🌽 STAFF — Turno ' || to_char(v_pcs.data, 'DD/MM'),
           '🌽 STAFF — Domani ' || to_char(v_pcs.ora_inizio, 'HH24:MI')
             || ' sei in pista per ' || v_pcs.corso_nome,
           'reminder', 'reminder_staff', 'inviata', 'sent',
           v_pcs.planning_id, v_pcs.data, true, 'staff', false)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_com_id;

        IF v_com_id IS NOT NULL THEN
          IF v_pcs.istruttore_id IS NOT NULL THEN
            SELECT uc.user_id
              INTO v_istr_user
              FROM public.istruttori i
              JOIN public.utenti_club uc
                ON uc.club_id = i.club_id
               AND uc.email IS NOT NULL AND uc.email = i.email AND i.email <> ''
             WHERE i.id = v_pcs.istruttore_id
             LIMIT 1;

            IF v_istr_user IS NOT NULL THEN
              INSERT INTO public.comunicazioni_destinatari_staff (comunicazione_id, user_id, club_id, stato)
              VALUES (v_com_id, v_istr_user, v_club.id, 'pending')
              ON CONFLICT DO NOTHING;
              v_total := v_total + 1;
            END IF;
          END IF;

          -- Monitori del corso (atleti con e_monitrice/e_aiuto): reminder via portale atleta
          FOR v_mon IN
            SELECT cm.persona_id
              FROM public.corsi_monitori cm
             WHERE cm.corso_id = v_pcs.corso_id
          LOOP
            INSERT INTO public.comunicazioni_destinatari (comunicazione_id, atleta_id, stato)
            VALUES (v_com_id, v_mon.persona_id, 'pending')
            ON CONFLICT DO NOTHING;
            v_total := v_total + 1;
          END LOOP;
        END IF;
      END IF;

    END LOOP;

    UPDATE public.clubs SET reminder_last_run_date = v_today_zh WHERE id = v_club.id;
  END LOOP;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_rsvp_atleta_assenza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_com RECORD;
  v_atleta RECORD;
BEGIN
  IF NEW.rsvp_risposta = 'no'
     AND (OLD.rsvp_risposta IS DISTINCT FROM 'no') THEN
    SELECT c.id, c.club_id, c.sotto_tipo, c.planning_corso_id, c.data_evento
      INTO v_com
      FROM public.comunicazioni c
     WHERE c.id = NEW.comunicazione_id;

    IF v_com.sotto_tipo = 'reminder_allenamento' THEN
      SELECT id, nome, cognome INTO v_atleta FROM public.atleti WHERE id = NEW.atleta_id;

      INSERT INTO public.presenze (club_id, persona_id, tipo_persona, data, metodo, riferimento_id, tipo_riferimento)
      VALUES (v_com.club_id, NEW.atleta_id, 'atleta', v_com.data_evento, 'dichiarata_no', v_com.planning_corso_id, 'planning_corso')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.comunicazioni
        (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
         atleta_id, planning_corso_id, data_evento, tipo_destinatari)
      VALUES
        (v_com.club_id,
         '❌ Assenza dichiarata atleta',
         '❌ Assenza dichiarata: ' || COALESCE(v_atleta.nome,'') || ' ' || COALESCE(v_atleta.cognome,'')
           || ' → ' || to_char(v_com.data_evento, 'DD/MM/YYYY'),
         'reminder_risposta', 'assenza_atleta', 'ricevuta', 'sent',
         NEW.atleta_id, v_com.planning_corso_id, v_com.data_evento, 'staff');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rsvp_atleta_assenza ON public.comunicazioni_destinatari;
CREATE TRIGGER trg_rsvp_atleta_assenza
  AFTER UPDATE OF rsvp_risposta ON public.comunicazioni_destinatari
  FOR EACH ROW EXECUTE FUNCTION public.trg_rsvp_atleta_assenza();

CREATE OR REPLACE FUNCTION public.trg_rsvp_staff_assenza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_com RECORD;
  v_nome text;
BEGIN
  IF NEW.rsvp_risposta = 'no'
     AND (OLD.rsvp_risposta IS DISTINCT FROM 'no') THEN
    SELECT c.id, c.club_id, c.sotto_tipo, c.planning_corso_id, c.data_evento
      INTO v_com
      FROM public.comunicazioni c
     WHERE c.id = NEW.comunicazione_id;

    IF v_com.sotto_tipo = 'reminder_staff' THEN
      SELECT COALESCE(raw_user_meta_data->>'full_name', email, 'Membro staff') INTO v_nome
        FROM auth.users WHERE id = NEW.user_id;

      INSERT INTO public.comunicazioni
        (club_id, titolo, testo, tipo, sotto_tipo, categoria, stato,
         planning_corso_id, data_evento, tipo_destinatari, urgente)
      VALUES
        (v_com.club_id,
         '⚠️ Assenza staff',
         '⚠️ Assenza staff: ' || COALESCE(v_nome,'?') || ' non sarà al corso del ' || to_char(v_com.data_evento,'DD/MM/YYYY'),
         'reminder_risposta', 'assenza_staff', 'ricevuta', 'sent',
         v_com.planning_corso_id, v_com.data_evento, 'staff', true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rsvp_staff_assenza ON public.comunicazioni_destinatari_staff;
CREATE TRIGGER trg_rsvp_staff_assenza
  AFTER UPDATE OF rsvp_risposta ON public.comunicazioni_destinatari_staff
  FOR EACH ROW EXECUTE FUNCTION public.trg_rsvp_staff_assenza();

DO $$
BEGIN
  PERFORM cron.unschedule('genera_reminder_giornalieri');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'genera_reminder_giornalieri',
  '5 * * * *',
  $$SELECT public.genera_reminder_giornalieri();$$
);
