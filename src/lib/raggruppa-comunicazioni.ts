// Lettura raggruppata delle comunicazioni.
//
// Regola: il significato di `atleta_id` cambia secondo `tipo_destinatari`.
//
// - tipo_destinatari = 'atleti'  → atleta_id È il destinatario. Il generatore scrive
//   una riga per atleta raggiunto: è UN invio solo e va raggruppato.
// - tipo_destinatari = 'staff'   → atleta_id è il SOGGETTO di cui si parla, non chi
//   riceve. Ogni riga è un fatto diverso: nessun raggruppamento. I destinatari veri
//   stanno in `comunicazioni_destinatari_staff`.
// - altri valori ('tutti', 'manuale', 'corso', ...) → la comunicazione è già una riga
//   sola con i destinatari in `comunicazioni_destinatari`: nessun raggruppamento.

export type GruppoComunicazioni = {
  /** Chiave stabile del gruppo (usata anche come key React). */
  key: string;
  /** Riga rappresentativa: la prima in ordine di elenco. */
  capofila: any;
  /** Tutte le righe dell'invio. */
  righe: any[];
  /** Id di tutte le righe: le azioni di gruppo lavorano su questi. */
  ids: string[];
  /** Quanti destinatari ha avuto l'invio (solo per gli invii ad atleti). */
  n_destinatari: number;
  /** True se le righe hanno testi diversi (messaggio personalizzato). */
  testo_personalizzato: boolean;
  /** True se il gruppo contiene una sola riga: il riquadro resta come prima. */
  singola: boolean;
  /** Natura del destinatario: decide etichetta e conteggio. */
  natura: "atleti" | "staff" | "altro";
};

/** Solo gli invii ad atleti si raggruppano. Gli altri restano righe singole. */
export function chiave_gruppo(c: any): string {
  if (c?.tipo_destinatari !== "atleti") return `riga|${c?.id ?? ""}`;
  const minuto = (c.created_at ?? "").slice(0, 16); // AAAA-MM-GGTHH:MM
  return [
    c.club_id ?? "",
    c.tipo ?? "",
    c.sotto_tipo ?? "",
    c.titolo ?? "",
    c.data_evento ?? "",
    minuto,
  ].join("|");
}

function natura_di(c: any): GruppoComunicazioni["natura"] {
  if (c?.tipo_destinatari === "atleti") return "atleti";
  if (c?.tipo_destinatari === "staff") return "staff";
  return "altro";
}

/** Mantiene l'ordine di arrivo delle righe (già ordinate dal chiamante). */
export function raggruppa_comunicazioni(righe: any[]): GruppoComunicazioni[] {
  const mappa = new Map<string, any[]>();
  righe.forEach((c) => {
    const k = chiave_gruppo(c);
    const lista = mappa.get(k);
    if (lista) lista.push(c);
    else mappa.set(k, [c]);
  });

  return Array.from(mappa.entries()).map(([key, lista]) => {
    const testi = new Set(lista.map((c) => c.testo ?? c.corpo ?? ""));
    return {
      key,
      capofila: lista[0],
      righe: lista,
      ids: lista.map((c) => c.id),
      n_destinatari: lista.length,
      testo_personalizzato: testi.size > 1,
      singola: lista.length === 1,
      natura: natura_di(lista[0]),
    };
  });
}

/** Quanti invii (non quante righe) ci sono in un elenco. */
export function conta_gruppi(righe: any[]): number {
  const chiavi = new Set(righe.map(chiave_gruppo));
  return chiavi.size;
}

/**
 * "Inviato a 25 atlete" per gli invii agli atleti, "Agli istruttori (8)" per le
 * notifiche allo staff (il conteggio arriva da `comunicazioni_destinatari_staff`).
 */
export function etichetta_destinatari_gruppo(
  gruppo: GruppoComunicazioni,
  n_destinatari_reali?: number,
): string {
  if (gruppo.natura === "atleti") {
    const n = gruppo.n_destinatari;
    return `Inviato a ${n} ${n === 1 ? "atleta" : "atlete"}`;
  }
  if (gruppo.natura === "staff") {
    return n_destinatari_reali != null
      ? `Agli istruttori (${n_destinatari_reali})`
      : "Agli istruttori";
  }
  return n_destinatari_reali != null
    ? `Destinatari (${n_destinatari_reali})`
    : "";
}

/** Tipi generati dal sistema senza intervento di una persona. */
export const TIPI_AUTOMATICI = [
  "reminder",
  "alert_regola",
  "reminder_risposta",
  "fattura",
  "iscrizione_atleta",
  "rifiuto_iscrizione",
  "annullamento_iscrizione",
];

export function is_automatica(c: any): boolean {
  return TIPI_AUTOMATICI.includes(c?.tipo);
}

const ETICHETTE_AUTOMATICHE: Record<string, [string, string]> = {
  assenza_atleta: ["assenza dichiarata", "assenze dichiarate"],
  assenze_ripetute: ["atleta a rischio", "atlete a rischio"],
  saturazione_bassa: ["corso poco pieno", "corsi poco pieni"],
  planning_giornaliero: ["programma del giorno", "programmi del giorno"],
  reminder_allenamento: ["promemoria allenamento", "promemoria allenamento"],
  reminder_staff: ["promemoria staff", "promemoria staff"],
  fattura_mensile_club: ["fattura mensile", "fatture mensili"],
};

const ETICHETTE_TIPO: Record<string, [string, string]> = {
  iscrizione_atleta: ["richiesta di iscrizione", "richieste di iscrizione"],
  rifiuto_iscrizione: ["iscrizione rifiutata", "iscrizioni rifiutate"],
  annullamento_iscrizione: ["iscrizione annullata", "iscrizioni annullate"],
  fattura: ["fattura", "fatture"],
  reminder: ["promemoria", "promemoria"],
  alert_regola: ["avviso", "avvisi"],
  reminder_risposta: ["risposta", "risposte"],
};

/** "68 assenze dichiarate, 31 atlete a rischio" */
export function riepilogo_automatiche(gruppi: GruppoComunicazioni[]): string {
  const conteggi = new Map<string, { n: number; sing: string; plur: string }>();
  gruppi.forEach((g) => {
    const c = g.capofila;
    const coppia =
      ETICHETTE_AUTOMATICHE[c?.sotto_tipo] ??
      ETICHETTE_TIPO[c?.tipo] ?? ["comunicazione", "comunicazioni"];
    const k = coppia[0];
    const prec = conteggi.get(k);
    if (prec) prec.n += 1;
    else conteggi.set(k, { n: 1, sing: coppia[0], plur: coppia[1] });
  });
  return Array.from(conteggi.values())
    .sort((a, b) => b.n - a.n)
    .map((v) => `${v.n} ${v.n === 1 ? v.sing : v.plur}`)
    .join(", ");
}
