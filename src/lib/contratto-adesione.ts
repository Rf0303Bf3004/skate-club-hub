// Testo del contratto di adesione mostrato nella pagina pubblica /iscrizione/:codice_atleta
// e in calce alla scheda anagrafica stampabile. I placeholder sono interpolati con i dati
// reali del club quando disponibili, altrimenti si usa un testo generico ragionevole.

export interface DatiContratto {
  club_nome?: string | null;
  club_citta?: string | null;
  club_cantone?: string | null;
  club_paese?: string | null;
  stagione_nome?: string | null;
  stagione_data_inizio?: string | null;
  stagione_data_fine?: string | null;
  clausole_contratto?: string | null;
}

export interface ArticoloContratto {
  numero: number;
  titolo: string;
  testo: string;
}

const fmt_data = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function build_contratto(dati: DatiContratto): ArticoloContratto[] {
  const club = (dati.club_nome || "").trim() || "il Club";
  const sede = [dati.club_citta, dati.club_cantone].filter(Boolean).join(", ").trim();
  const paese = (dati.club_paese || "").trim();
  const svizzera = !paese || /svizzera|switzerland|ch/i.test(paese);

  const inizio = fmt_data(dati.stagione_data_inizio);
  const fine = fmt_data(dati.stagione_data_fine);
  const stagione = (dati.stagione_nome || "").trim() || "la stagione sportiva corrente";

  const durata = fine
    ? `Il presente contratto decorre dal momento della sottoscrizione ed è valido fino al termine di ${stagione}${inizio ? ` (dal ${inizio}` : ""}${inizio && fine ? ` al ${fine})` : fine && !inizio ? ` (fino al ${fine})` : inizio ? ")" : ""}. Non è previsto alcun rinnovo tacito: l'adesione a una nuova stagione richiede una nuova sottoscrizione.`
    : `Il presente contratto decorre dal momento della sottoscrizione e resta valido senza scadenza automatica fino a disdetta scritta di una delle parti. Non è previsto alcun rinnovo tacito: l'adesione a una nuova stagione richiede una nuova sottoscrizione.`;

  const foro = sede
    ? `Per ogni controversia derivante dal presente contratto è competente il foro della sede del Club (${sede}) e si applica ${svizzera ? "il diritto svizzero" : "la legge dello Stato in cui il Club ha sede"}.`
    : `Per ogni controversia derivante dal presente contratto è competente il foro della sede del Club e si applica ${svizzera ? "il diritto svizzero" : "la legge dello Stato in cui il Club ha sede"}.`;

  const privacy = `Il genitore/tutore acconsente al trattamento dei dati personali propri e dell'atleta da parte di ${club} ai sensi ${svizzera ? "della Legge federale svizzera sulla protezione dei dati (LPD)" : "del Regolamento UE 2016/679 (GDPR)"}, per le finalità di gestione dell'iscrizione, fatturazione, comunicazioni e adempimenti sportivi e assicurativi. I dati non sono ceduti a terzi se non per obblighi di legge o federali.`;

  const articoli: ArticoloContratto[] = [
    {
      numero: 1,
      titolo: "Oggetto",
      testo: `Il presente contratto ha per oggetto l'adesione dell'atleta alle attività sportive organizzate da ${club} (corsi, allenamenti, eventi, gare) per ${stagione}, nonché l'utilizzo della piattaforma Ice Arena Manager per l'iscrizione, le comunicazioni e la rilevazione delle presenze.`,
    },
    { numero: 2, titolo: "Durata", testo: durata },
    {
      numero: 3,
      titolo: "Quote di iscrizione e pagamenti",
      testo: `Le quote di iscrizione e le eventuali quote per attività aggiuntive sono determinate dal tariffario vigente di ${club} e vengono fatturate tramite la piattaforma Ice Arena Manager, secondo le scadenze indicate in fattura.`,
    },
    {
      numero: 4,
      titolo: "Idoneità sportiva",
      testo: `Il genitore/tutore dichiara che l'atleta si trova in buone condizioni psicofisiche e idonee alla pratica dell'attività sportiva, e si impegna a segnalare tempestivamente al Club ogni variazione rilevante dello stato di salute.`,
    },
    {
      numero: 5,
      titolo: "Regolamento interno",
      testo: `Il genitore/tutore dichiara di accettare il regolamento interno del Club relativo a orari, comportamento in pista, uso degli spogliatoi e dell'attrezzatura, impegnandosi a farlo rispettare all'atleta.`,
    },
    {
      numero: 6,
      titolo: "Responsabilità",
      testo: `Il Club adotta le misure organizzative ordinarie di sicurezza. Il genitore/tutore è consapevole del rischio intrinseco alla pratica del pattinaggio su ghiaccio e solleva il Club da ogni responsabilità per incidenti non riconducibili a dolo o colpa grave del Club stesso o dei suoi collaboratori.`,
    },
    { numero: 7, titolo: "Trattamento dei dati personali", testo: privacy },
    {
      numero: 8,
      titolo: "Consenso foto e video",
      testo: `Il genitore/tutore autorizza o nega, tramite l'apposita scelta nel presente modulo, l'utilizzo di fotografie e video dell'atleta per la comunicazione istituzionale del Club (sito web, social media, materiale informativo). Il consenso è facoltativo e revocabile in ogni momento con comunicazione scritta al Club.`,
    },
    {
      numero: 9,
      titolo: "Foto profilo e utilizzo dell'app",
      testo: `Il genitore/tutore carica la foto profilo dell'atleta e completa i dati anagrafici tramite l'app o la pagina web dedicata messa a disposizione dal Club. La foto è utilizzata esclusivamente per finalità gestionali interne (riconoscimento in pista, elenchi corsi, schede atleta).`,
    },
    {
      numero: 10,
      titolo: "Recesso",
      testo: `Il genitore/tutore può recedere in ogni momento mediante comunicazione scritta al Club, fermo restando quanto dovuto per le prestazioni già erogate e per le quote già maturate alla data del recesso.`,
    },
    { numero: 11, titolo: "Foro competente e legge applicabile", testo: foro },
  ];

  const clausole = (dati.clausole_contratto || "").trim();
  if (clausole) {
    articoli.push({ numero: 12, titolo: "Clausole aggiuntive del Club", testo: clausole });
  }

  return articoli;
}
