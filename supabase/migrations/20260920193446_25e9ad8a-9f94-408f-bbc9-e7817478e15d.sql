ALTER TABLE public.lezioni_private
  ADD COLUMN IF NOT EXISTS risorsa_id uuid NULL REFERENCES public.risorse_strutture(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lezioni_private.risorsa_id IS
  'Pista o palestra su cui si svolge la lezione privata. Serve a sapere chi occupa quale risorsa quando il club ne ha piu'' di una. Nullo se non indicata.';

ALTER TABLE public.griglia_sessioni
  ADD COLUMN IF NOT EXISTS lezione_privata_id uuid NULL REFERENCES public.lezioni_private(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.griglia_sessioni.lezione_privata_id IS
  'Lezione privata collocata in questa sessione di griglia. Nullo per le sessioni di corso. Una lezione privata sta in una sessione sola.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_griglia_sessioni_lezione_privata_unique
  ON public.griglia_sessioni (lezione_privata_id)
  WHERE lezione_privata_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.genera_settimana_planning(p_settimana_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_data_lunedi date;
  v_club_id uuid;
  v_stagione_id uuid;
  v_inseriti integer := 0;
BEGIN
  SELECT data_lunedi, club_id, stagione_id INTO v_data_lunedi, v_club_id, v_stagione_id
    FROM public.planning_settimane WHERE id = p_settimana_id;
  IF v_data_lunedi IS NULL THEN RAISE EXCEPTION 'Settimana % non trovata', p_settimana_id; END IF;
  IF v_stagione_id IS NULL THEN RETURN 0; END IF;

  WITH inseriti AS (
    INSERT INTO public.planning_corsi_settimana
      (settimana_id, corso_id, data, ora_inizio, ora_fine, istruttore_id, annullato, is_evento_extra)
    SELECT p_settimana_id, s.corso_id, b.data, s.ora_inizio, s.ora_fine,
      (SELECT si.istruttore_id FROM public.griglia_sessioni_istruttori si
       WHERE si.sessione_id = s.id ORDER BY si.created_at ASC LIMIT 1),
      false, false
    FROM public.griglia_blocchi b
    JOIN public.griglia_sessioni s ON s.blocco_id = b.id
    WHERE b.club_id = v_club_id AND b.data >= v_data_lunedi AND b.data <= v_data_lunedi + 6
      AND s.corso_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.planning_corsi_settimana p
                      WHERE p.settimana_id = p_settimana_id AND p.corso_id = s.corso_id)
    ON CONFLICT (settimana_id, corso_id) WHERE annullato = false AND is_evento_extra = false DO NOTHING
    RETURNING 1)
  SELECT count(*) INTO v_inseriti FROM inseriti;

  -- Anche le lezioni private arrivano dalla griglia: sono le sessioni con
  -- lezione_privata_id valorizzato. Il planning non ha piu' una sorgente propria.
  INSERT INTO public.planning_private_settimana
    (settimana_id, lezione_privata_id, data, ora_inizio, ora_fine, istruttore_id, annullato)
  SELECT p_settimana_id, s.lezione_privata_id, b.data, s.ora_inizio, s.ora_fine,
    (SELECT si.istruttore_id FROM public.griglia_sessioni_istruttori si
     WHERE si.sessione_id = s.id ORDER BY si.created_at ASC LIMIT 1),
    false
  FROM public.griglia_blocchi b
  JOIN public.griglia_sessioni s ON s.blocco_id = b.id
  WHERE b.club_id = v_club_id AND b.data >= v_data_lunedi AND b.data <= v_data_lunedi + 6
    AND s.lezione_privata_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.planning_private_settimana pp
                    WHERE pp.settimana_id = p_settimana_id
                      AND pp.lezione_privata_id = s.lezione_privata_id);

  RETURN COALESCE(v_inseriti, 0);
END; $function$;

COMMENT ON FUNCTION public.genera_settimana_planning(uuid) IS
  'Riempie il planning della settimana leggendo la GRIGLIA, unica sorgente: le sessioni con corso_id popolano planning_corsi_settimana, quelle con lezione_privata_id popolano planning_private_settimana. Per ogni sessione scrive la data del blocco, gli orari della sessione e il primo istruttore assegnato (nullo se nessuno). Le righe gia'' presenti per quella settimana vengono saltate. Una settimana senza stagione restituisce 0 senza scrivere. Il valore restituito resta il numero di righe di CORSI inserite.';

CREATE OR REPLACE FUNCTION public.approva_richiesta_privata(
  p_richiesta_id uuid,
  p_istruttore_id uuid,
  p_data date,
  p_ora_inizio time without time zone,
  p_durata_minuti integer,
  p_ricorrenza text,
  p_ripetizioni integer,
  p_costo_totale numeric DEFAULT 0,
  p_note text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_r record;
  v_n int;
  v_i int;
  v_data date;
  v_fine time;
  v_lezione_id uuid;
  v_prima uuid;
  v_create int := 0;
  v_problemi text[] := array[]::text[];
  v_settimana uuid;
  v_settimane uuid[] := array[]::uuid[];
  v_occupato int;
  v_stagione uuid;
  v_risorsa uuid;
  v_blocco uuid;
  v_sessione uuid;
  v_motivo constant text := 'Lezione privata approvata fuori dalle fasce dichiarate';
begin
  if not ruolo_in(array['superadmin','admin','presidente','vicepresidente','dt']) then
    raise exception 'Solo il direttore tecnico o la presidenza possono approvare una richiesta.'
      using errcode = '42501';
  end if;

  select * into v_r from richieste_lezioni_private where id = p_richiesta_id;
  if v_r.id is null then
    raise exception 'Richiesta non trovata.' using errcode = 'P0002';
  end if;
  if not user_is_admin_like() and v_r.club_id is distinct from user_club_id() then
    raise exception 'Richiesta di un altro club.' using errcode = '42501';
  end if;
  if v_r.stato <> 'in_attesa' then
    raise exception 'Questa richiesta è già stata gestita.' using errcode = '23514';
  end if;

  if p_ricorrenza not in ('una_tantum','settimanale') then
    raise exception 'Tipo di ricorrenza non valido.' using errcode = '22023';
  end if;
  v_n := case when p_ricorrenza = 'settimanale' then greatest(1, least(52, coalesce(p_ripetizioni,1))) else 1 end;

  if p_istruttore_id is null or p_data is null or p_ora_inizio is null or coalesce(p_durata_minuti,0) <= 0 then
    raise exception 'Servono istruttore, data, ora e durata.' using errcode = '22023';
  end if;

  v_fine := p_ora_inizio + make_interval(mins => p_durata_minuti);

  select id into v_stagione from stagioni where club_id = v_r.club_id and attiva limit 1;

  for v_i in 0 .. v_n - 1 loop
    v_data := p_data + (v_i * 7);

    select count(*) into v_occupato
      from lezioni_private l
     where l.club_id = v_r.club_id
       and l.istruttore_id = p_istruttore_id
       and l.data = v_data
       and not l.annullata
       and l.ora_inizio < v_fine
       and l.ora_fine > p_ora_inizio;
    if v_occupato > 0 then
      v_problemi := v_problemi || format('%s: l''istruttore ha già una lezione a quell''ora', to_char(v_data,'DD.MM.YYYY'));
    end if;

    insert into lezioni_private
      (club_id, istruttore_id, data, ora_inizio, ora_fine, durata_minuti,
       condivisa, costo_totale, ricorrente, annullata, note,
       richiede_approvazione, richiesta_id)
    values
      (v_r.club_id, p_istruttore_id, v_data, p_ora_inizio, v_fine, p_durata_minuti,
       false, coalesce(p_costo_totale,0), p_ricorrenza = 'settimanale', false,
       coalesce(p_note, v_r.note_richiesta),
       false, v_r.id)
    returning id, risorsa_id into v_lezione_id, v_risorsa;

    insert into lezioni_private_atlete (lezione_id, atleta_id, quota_costo)
    values (v_lezione_id, v_r.atleta_id, coalesce(p_costo_totale,0));

    v_create := v_create + 1;
    if v_prima is null then v_prima := v_lezione_id; end if;

    -- La lezione atterra nella griglia: eredita i controlli di ghiaccio e di
    -- disponibilita' invece di avere una strada propria.
    select b.id into v_blocco
      from griglia_blocchi b
     where b.club_id = v_r.club_id
       and b.data = v_data
       and b.risorsa_id is not distinct from v_risorsa
       and b.ora_inizio <= p_ora_inizio
       and b.ora_fine >= v_fine
     order by b.created_at asc
     limit 1;

    if v_blocco is null then
      begin
        insert into griglia_blocchi
          (club_id, data, risorsa_id, stagione_id, ora_inizio, ora_fine, titolo, stato, creato_da)
        values
          (v_r.club_id, v_data, v_risorsa, v_stagione, p_ora_inizio, v_fine, 'Lezioni private', 'pubblicato', auth.uid())
        returning id into v_blocco;
      exception when others then
        insert into griglia_blocchi
          (club_id, data, risorsa_id, stagione_id, ora_inizio, ora_fine, titolo, stato, creato_da,
           fuori_disponibilita, motivo_forzatura, forzato_da, forzato_at)
        values
          (v_r.club_id, v_data, v_risorsa, v_stagione, p_ora_inizio, v_fine, 'Lezioni private', 'pubblicato', auth.uid(),
           true, v_motivo, auth.uid(), now())
        returning id into v_blocco;
        v_problemi := v_problemi || format('%s: %s', to_char(v_data,'DD.MM.YYYY'), v_motivo);
      end;
    end if;

    insert into griglia_sessioni (blocco_id, ordine, ora_inizio, ora_fine, corso_id, lezione_privata_id)
    values (v_blocco, 0, p_ora_inizio, v_fine, null, v_lezione_id)
    returning id into v_sessione;

    insert into griglia_sessioni_atleti (sessione_id, atleta_id, club_id)
    values (v_sessione, v_r.atleta_id, v_r.club_id);

    begin
      insert into griglia_sessioni_istruttori (sessione_id, istruttore_id)
      values (v_sessione, p_istruttore_id);
    exception when others then
      update griglia_sessioni
         set fuori_disponibilita = true,
             motivo_forzatura = v_motivo,
             forzato_da = auth.uid(),
             forzato_at = now()
       where id = v_sessione;
      insert into griglia_sessioni_istruttori (sessione_id, istruttore_id)
      values (v_sessione, p_istruttore_id);
      v_problemi := v_problemi || format('%s: istruttore fuori dalla disponibilità dichiarata', to_char(v_data,'DD.MM.YYYY'));
    end;

    -- Il planning non si scrive piu' a mano: si rigenera dalla griglia.
    v_settimana := settimana_planning(v_r.club_id, v_data);
    if v_settimana is null then
      v_problemi := v_problemi || format('%s: nessuna stagione copre questa data, la lezione resta fuori dal planning', to_char(v_data,'DD.MM.YYYY'));
    elsif not (v_settimana = any(v_settimane)) then
      v_settimane := v_settimane || v_settimana;
    end if;
  end loop;

  foreach v_settimana in array v_settimane loop
    perform genera_settimana_planning(v_settimana);
  end loop;

  update richieste_lezioni_private
     set stato = 'accettata',
         lezione_id = v_prima,
         ricorrenza = p_ricorrenza,
         ripetizioni = v_n,
         gestita_da = auth.uid(),
         gestita_il = now()
   where id = v_r.id;

  return jsonb_build_object(
    'lezioni_create', v_create,
    'prima_lezione', v_prima,
    'problemi', to_jsonb(v_problemi)
  );
end $function$;