// Lettura raggruppata delle comunicazioni.
//
// I generatori automatici scrivono UNA riga per destinatario (è corretto: nell'app
// ogni genitore deve vedere solo il messaggio del proprio figlio). La pagina del
// club però deve mostrare UN riquadro per invio: qui si raggruppano le righe per
// club_id + tipo + sotto_tipo + titolo + minuto di creazione, esattamente come
// date_trunc('minute', created_at) lato database.

export type GruppoComunicazioni = {
  /** Chiave stabile del gruppo (usata anche come key React). */
  key: string;
  /** Riga rappresentativa: la prima in ordine di elenco. */
  capofila: any;
  /** Tutte le righe dell'invio. */
  righe: any[];
  /** Id di tutte le righe: le azioni di gruppo lavorano su questi. */
  ids: string[];
  /** Quanti destinatari ha avuto l'invio. */
  n_destinatari: number;
  /** True se le righe hanno testi diversi (messaggio personalizzato). */
  testo_personalizzato: boolean;
  /** True se il gruppo contiene una sola riga: il riquadro resta come prima. */
  singola: boolean;
};

export function chiave_gruppo(c: any): string {
  const minuto = (c.created_at ?? "").slice(0, 16); // AAAA-MM-GGTHH:MM
  return [c.club_id ?? "", c.tipo ?? "", c.sotto_tipo ?? "", c.titolo ?? "", minuto].join("|");
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
    };
  });
}

/** Quanti invii (non quante righe) ci sono in un elenco. */
export function conta_gruppi(righe: any[]): number {
  const chiavi = new Set(righe.map(chiave_gruppo));
  return chiavi.size;
}

const RUOLI_STAFF = ["solo_istruttori", "solo_staff", "istruttori", "staff", "ruoli"];

/** "Inviato a 25 atlete" oppure "Inviato a 5 istruttori". */
export function etichetta_destinatari_gruppo(gruppo: GruppoComunicazioni): string {
  const c = gruppo.capofila;
  const n = gruppo.n_destinatari;
  const verso_staff =
    RUOLI_STAFF.includes(c?.tipo_destinatari) ||
    (Array.isArray(c?.ruoli_destinatari) && c.ruoli_destinatari.length > 0 && !c?.atleta_id);
  if (verso_staff) return `Inviato a ${n} ${n === 1 ? "istruttore" : "istruttori"}`;
  return `Inviato a ${n} ${n === 1 ? "atleta" : "atlete"}`;
}
