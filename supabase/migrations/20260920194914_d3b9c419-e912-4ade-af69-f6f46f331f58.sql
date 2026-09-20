
alter table public.richieste_lezioni_private
  add column if not exists data_richiesta date,
  add column if not exists ora_inizio time,
  add column if not exists ora_fine time,
  add column if not exists risorsa_id uuid references public.risorse_strutture(id) on delete set null;

comment on column public.richieste_lezioni_private.data_richiesta is 'Giorno scelto dalla famiglia fra le finestre realmente libere: è un momento vero, non una preferenza.';
comment on column public.richieste_lezioni_private.ora_inizio is 'Ora di inizio scelta dalla famiglia fra le finestre realmente libere: è un momento vero, non una preferenza.';
comment on column public.richieste_lezioni_private.ora_fine is 'Ora di fine scelta dalla famiglia fra le finestre realmente libere: è un momento vero, non una preferenza.';
comment on column public.richieste_lezioni_private.risorsa_id is 'Pista o palestra della finestra scelta dalla famiglia: è un momento vero, non una preferenza.';

create or replace function public.approva_richiesta_privata(
  p_richiesta_id uuid,
  p_istruttore_id uuid,
  p_data date,
  p_ora_inizio time without time zone,
  p_durata_minuti integer,
  p_ricorrenza text,
  p_ripetizioni integer,
  p_costo_totale numeric default 0,
  p_note text default null,
  p_ora_fine time without time zone default null,
  p_risorsa_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_r record;
  v_n int;
  v_i int;
  v_data date;
  v_inizio time;
  v_fine time;
  v_durata int;
  v_risorsa uuid;
  v_lezione_id uuid;
  v_prima uuid;
  v_create int := 0;
  v_problemi text[] := array[]::text[];
  v_settimana uuid;
  v_settimane uuid[] := array[]::uuid[];
  v_occupato int;
  v_stagione uuid;
  v_blocco uuid;
  v_sessione uuid;
  v_ok boolean;
  v_ha_ghiaccio boolean;
  v_ha_istruttore boolean;
  v_giorno text;
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

  -- Il momento: quello passato da chi approva, altrimenti quello scritto sulla richiesta.
  v_data    := coalesce(p_data, v_r.data_richiesta);
  v_inizio  := coalesce(p_ora_inizio, v_r.ora_inizio);
  v_fine    := coalesce(p_ora_fine, v_r.ora_fine);
  v_risorsa := coalesce(p_risorsa_id, v_r.risorsa_id);

  if v_fine is null and v_inizio is not null and coalesce(p_durata_minuti,0) > 0 then
    v_fine := v_inizio + make_interval(mins => p_durata_minuti);
  end if;

  if p_istruttore_id is null or v_data is null or v_inizio is null or v_fine is null then
    raise exception 'La richiesta non indica un momento: scegli data, ora di inizio e ora di fine prima di approvare.'
      using errcode = '22023';
  end if;
  if v_fine <= v_inizio then
    raise exception 'L''ora di fine deve essere successiva all''ora di inizio.' using errcode = '22023';
  end if;

  v_durata := extract(epoch from (v_fine - v_inizio))::int / 60;

  select id into v_stagione from stagioni where club_id = v_r.club_id and attiva limit 1;

  -- Verifica di TUTTE le occorrenze prima di creare qualunque cosa.
  for v_i in 0 .. v_n - 1 loop
    select exists (
      select 1 from finestre_private_disponibili(v_r.club_id, p_istruttore_id,
                                                 v_data + (v_i * 7), v_data + (v_i * 7), 1) f
       where f.dalle <= v_inizio and f.alle >= v_fine
         and (v_risorsa is null or f.risorsa_id = v_risorsa)
    ) into v_ok;

    if not v_ok then
      v_giorno := lower(translate(
        (array['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'])
          [extract(dow from (v_data + (v_i * 7)))::int + 1], 'ìàèéù', 'iaeeu'));

      select exists (
        select 1 from disponibilita_ghiaccio d
         where d.club_id = v_r.club_id and coalesce(d.tipo,'') <> 'pulizia'
           and (d.stagione_id is null or d.stagione_id = v_stagione)
           and (v_risorsa is null or d.risorsa_id = v_risorsa)
           and lower(translate(d.giorno, 'ìàèéù', 'iaeeu')) = v_giorno
           and d.ora_inizio <= v_inizio and d.ora_fine >= v_fine
      ) into v_ha_ghiaccio;

      select exists (
        select 1 from disponibilita_istruttori di
         where di.istruttore_id = p_istruttore_id
           and lower(translate(di.giorno, 'ìàèéù', 'iaeeu')) = v_giorno
           and di.ora_inizio <= v_inizio and di.ora_fine >= v_fine
      ) into v_ha_istruttore;

      if not v_ha_ghiaccio then
        raise exception 'Il % non c''è ghiaccio dichiarato in quel momento: la lezione non può essere approvata.',
          to_char(v_data + (v_i * 7), 'DD.MM.YYYY') using errcode = '23514';
      elsif not v_ha_istruttore then
        raise exception 'Il % l''istruttore non è disponibile in quel momento: la lezione non può essere approvata.',
          to_char(v_data + (v_i * 7), 'DD.MM.YYYY') using errcode = '23514';
      else
        raise exception 'Il % quel momento non è più libero: è stato occupato nel frattempo.',
          to_char(v_data + (v_i * 7), 'DD.MM.YYYY') using errcode = '23514';
      end if;
    end if;
  end loop;

  for v_i in 0 .. v_n - 1 loop
    v_data := coalesce(p_data, v_r.data_richiesta) + (v_i * 7);

    select count(*) into v_occupato
      from lezioni_private l
     where l.club_id = v_r.club_id
       and l.istruttore_id = p_istruttore_id
       and l.data = v_data
       and not l.annullata
       and l.ora_inizio < v_fine
       and l.ora_fine > v_inizio;
    if v_occupato > 0 then
      raise exception 'Il % l''istruttore ha già una lezione a quell''ora.', to_char(v_data,'DD.MM.YYYY')
        using errcode = '23514';
    end if;

    insert into lezioni_private
      (club_id, istruttore_id, data, ora_inizio, ora_fine, durata_minuti,
       condivisa, costo_totale, ricorrente, annullata, note,
       richiede_approvazione, richiesta_id, risorsa_id)
    values
      (v_r.club_id, p_istruttore_id, v_data, v_inizio, v_fine, v_durata,
       false, coalesce(p_costo_totale,0), p_ricorrenza = 'settimanale', false,
       coalesce(p_note, v_r.note_richiesta),
       false, v_r.id, v_risorsa)
    returning id into v_lezione_id;

    insert into lezioni_private_atlete (lezione_id, atleta_id, quota_costo)
    values (v_lezione_id, v_r.atleta_id, coalesce(p_costo_totale,0));

    v_create := v_create + 1;
    if v_prima is null then v_prima := v_lezione_id; end if;

    -- La lezione atterra nella griglia: eredita i controlli invece di avere una strada propria.
    select b.id into v_blocco
      from griglia_blocchi b
     where b.club_id = v_r.club_id
       and b.data = v_data
       and b.risorsa_id is not distinct from v_risorsa
       and b.ora_inizio <= v_inizio
       and b.ora_fine >= v_fine
     order by b.created_at asc
     limit 1;

    if v_blocco is null then
      insert into griglia_blocchi
        (club_id, data, risorsa_id, stagione_id, ora_inizio, ora_fine, titolo, stato, creato_da)
      values
        (v_r.club_id, v_data, v_risorsa, v_stagione, v_inizio, v_fine, 'Lezioni private', 'pubblicato', auth.uid())
      returning id into v_blocco;
    end if;

    insert into griglia_sessioni (blocco_id, ordine, ora_inizio, ora_fine, corso_id, lezione_privata_id)
    values (v_blocco, 0, v_inizio, v_fine, null, v_lezione_id)
    returning id into v_sessione;

    insert into griglia_sessioni_atleti (sessione_id, atleta_id, club_id)
    values (v_sessione, v_r.atleta_id, v_r.club_id);

    insert into griglia_sessioni_istruttori (sessione_id, istruttore_id)
    values (v_sessione, p_istruttore_id);

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

comment on function public.approva_richiesta_privata(uuid, uuid, date, time, integer, text, integer, numeric, text, time, uuid) is
'Approva una richiesta di lezione privata. Regola: una lezione fuori dalle fasce di ghiaccio o fuori dalla disponibilità dell''istruttore NON può esistere: non si forza e non si segnala, non si approva. Il momento è quello passato da chi approva, altrimenti quello scritto sulla richiesta (data_richiesta, ora_inizio, ora_fine, risorsa_id); se manca, la funzione si ferma. Ogni occorrenza della ricorrenza viene verificata PRIMA di creare qualunque cosa con finestre_private_disponibili: se una sola non sta dentro una finestra libera sulla stessa risorsa, l''approvazione si ferma e dice la data e se manca il ghiaccio o l''istruttore. Verificato tutto, la lezione atterra nella griglia (blocco esistente o nuovo, sessione con lezione_privata_id, atleta e istruttore) e il planning si rigenera dalla griglia.';
