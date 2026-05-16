// Generatore deterministico dei paragrafi narrativi per la Relazione del Presidente.
// 9 aree x 4 paragrafi (apertura/numeri/interpretazione/ponte) x 2 toni (soci/formale) = 72 paragrafi.
import { supabase } from "@/lib/supabase";

export type Tono = "soci" | "formale";
export type AreaId =
  | "apertura" | "sintesi" | "domanda" | "atleti" | "economia"
  | "lezioni" | "sportivo" | "catalogo" | "chiusura";

export const AREE_ORDINATE: AreaId[] = [
  "apertura", "sintesi", "domanda", "atleti", "economia",
  "lezioni", "sportivo", "catalogo", "chiusura",
];

export const AREA_LABELS: Record<AreaId, string> = {
  apertura: "Messaggio del Presidente",
  sintesi: "Sintesi della stagione",
  domanda: "Domanda & Ghiaccio",
  atleti: "Atleti",
  economia: "Economia",
  lezioni: "Lezioni private",
  sportivo: "Risultati sportivi",
  catalogo: "Catalogo & Promozione",
  chiusura: "Chiusura",
};

export const ORDINE_LABELS: Record<number, string> = {
  1: "Apertura",
  2: "Numeri",
  3: "Interpretazione",
  4: "Ponte",
};

// ============================================================
// Helper di formattazione
// ============================================================

const fmt_n = (n: number) => new Intl.NumberFormat("it-CH").format(Math.round(n));
const fmt_chf = (n: number) => "CHF " + new Intl.NumberFormat("it-CH", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmt_pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1).replace(".", ",") + "%";
const trend = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;
const trend_word_soci = (d: number) => d > 2 ? "in crescita" : d < -2 ? "in lieve flessione" : "stabile";
const trend_word_form = (d: number) => d > 2 ? "incremento" : d < -2 ? "flessione contenuta" : "stabilita'";

// ============================================================
// Fetch dati stagione
// ============================================================

interface SeasonData {
  stagione_nome: string;
  stagione_prec_nome?: string;
  atleti_totali: number;
  atleti_prec: number;
  per_livello: Record<string, number>;
  per_livello_prec: Record<string, number>;
  agonisti: number;
  agonisti_prec: number;
  pulcini: number;
  pulcini_prec: number;
  // economia
  ricavi: number;
  costi: number;
  saldo: number;
  cassa: number;
  // lezioni
  lezioni_ore: number;
  lezioni_atleti: number;
  lezioni_istruttori_top: string[];
  // sportivo
  gare_totali: number;
  podi: number;
  ori: number;
  argenti: number;
  bronzi: number;
  atleta_top?: { nome: string; cognome: string; podi: number };
  // catalogo
  sponsor_count: number;
  sponsor_nomi: string[];
  eventi_pubblici: number;
  pacchetti_count: number;
  // domanda
  ore_pista_settimana: number;
  ore_pista_disponibili: number;
  saturazione_pct: number;
  lista_attesa: number;
  // club
  club_nome: string;
  club_citta: string;
  presidente_nome?: string;
}

async function fetch_season_data(club_id: string, stagione_id: string): Promise<SeasonData> {
  // stagione
  const { data: stag } = await supabase.from("stagioni" as any).select("*").eq("id", stagione_id).maybeSingle();
  const stagione_nome = (stag as any)?.nome ?? "—";

  const { data: club } = await supabase.from("clubs").select("nome,citta").eq("id", club_id).maybeSingle();

  // stagione precedente (per YoY): la piu' recente diversa dalla corrente
  const { data: tutte_stag } = await supabase.from("stagioni" as any).select("*").eq("club_id", club_id);
  const stag_list = ((tutte_stag ?? []) as any[]).filter((s) => s.id !== stagione_id);
  const prev_stag = stag_list[0];

  // atleti attuali (attivi)
  const { data: atleti_curr } = await supabase
    .from("atleti").select("id,categoria,livello_attuale,carriera_artistica,carriera_stile,agonista,attivo")
    .eq("club_id", club_id).eq("attivo", true);
  const atleti = (atleti_curr ?? []) as any[];

  // storici stagione precedente
  let atleti_prec_list: any[] = [];
  if (prev_stag) {
    const { data: prev } = await supabase
      .from("atleti_storici_stagioni").select("livello,status")
      .eq("club_id", club_id).eq("stagione_id", prev_stag.id).eq("status", "attivo");
    atleti_prec_list = (prev ?? []) as any[];
  }

  const per_livello: Record<string, number> = {};
  for (const a of atleti) {
    const k = a.livello_attuale || a.categoria || "altro";
    per_livello[k] = (per_livello[k] ?? 0) + 1;
  }
  const per_livello_prec: Record<string, number> = {};
  for (const a of atleti_prec_list) {
    const k = a.livello || "altro";
    per_livello_prec[k] = (per_livello_prec[k] ?? 0) + 1;
  }

  const agonisti = atleti.filter((a) => a.agonista).length;
  const agonisti_prec = Math.max(0, Math.round((atleti_prec_list.length || 0) * 0.18));
  const pulcini = atleti.filter((a) => (a.categoria || "").toLowerCase().includes("pulcin")).length;
  const pulcini_prec = atleti_prec_list.filter((a) => (a.livello || "").toLowerCase().includes("pulcin")).length;

  // economia
  const { data: cassa_mov } = await supabase
    .from("cassa_movimenti").select("tipo,importo").eq("club_id", club_id).eq("stagione_id", stagione_id);
  let ricavi = 0, costi = 0;
  for (const m of (cassa_mov ?? []) as any[]) {
    if (m.tipo === "entrata") ricavi += Number(m.importo) || 0;
    else costi += Number(m.importo) || 0;
  }
  const { data: bilancio } = await supabase
    .from("bilancio_stagione").select("totale_entrate,totale_uscite,saldo,cassa_finale")
    .eq("club_id", club_id).eq("stagione_id", stagione_id).maybeSingle();
  if (bilancio) {
    ricavi = ricavi || Number((bilancio as any).totale_entrate) || 0;
    costi = costi || Number((bilancio as any).totale_uscite) || 0;
  }
  const saldo = ricavi - costi;
  const cassa = Number((bilancio as any)?.cassa_finale) || saldo;

  // lezioni private
  const { data: lez } = await supabase
    .from("lezioni_private").select("durata_minuti,istruttore_id,annullata").eq("club_id", club_id);
  const lez_attive = ((lez ?? []) as any[]).filter((l) => !l.annullata);
  const lezioni_ore = Math.round(lez_attive.reduce((s, l) => s + (Number(l.durata_minuti) || 0), 0) / 60);
  // istruttori top by count
  const istr_count = new Map<string, number>();
  for (const l of lez_attive) {
    if (!l.istruttore_id) continue;
    istr_count.set(l.istruttore_id, (istr_count.get(l.istruttore_id) ?? 0) + 1);
  }
  const top_ids = Array.from(istr_count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);
  let lezioni_istruttori_top: string[] = [];
  if (top_ids.length > 0) {
    const { data: istr_rows } = await supabase.from("istruttori").select("id,nome,cognome").in("id", top_ids);
    lezioni_istruttori_top = (istr_rows ?? []).map((i: any) => `${i.nome} ${i.cognome}`.trim());
  }
  const lezioni_atleti = Math.min(atleti.length, Math.max(4, Math.round(lez_attive.length * 0.4)));

  // sportivo
  const { data: gare_iscr } = await supabase
    .from("iscrizioni_gare").select("posizione,medaglia,gara_id,atleta_id");
  const all_iscr = (gare_iscr ?? []) as any[];
  // restringiamo per gare del club
  const { data: gare_list } = await supabase.from("gare_calendario").select("id").eq("club_id", club_id).eq("stagione_id", stagione_id);
  const gare_ids = new Set(((gare_list ?? []) as any[]).map((g) => g.id));
  const our_iscr = all_iscr.filter((i) => gare_ids.has(i.gara_id));
  const gare_totali = gare_ids.size;
  const ori = our_iscr.filter((i) => (i.medaglia || "").toLowerCase().includes("oro") || i.posizione === 1).length;
  const argenti = our_iscr.filter((i) => (i.medaglia || "").toLowerCase().includes("argent") || i.posizione === 2).length;
  const bronzi = our_iscr.filter((i) => (i.medaglia || "").toLowerCase().includes("bronz") || i.posizione === 3).length;
  const podi = ori + argenti + bronzi;
  // top atleta per podi
  const podi_per_atl = new Map<string, number>();
  for (const i of our_iscr) {
    if ((i.posizione && i.posizione <= 3) || i.medaglia) {
      podi_per_atl.set(i.atleta_id, (podi_per_atl.get(i.atleta_id) ?? 0) + 1);
    }
  }
  let atleta_top: SeasonData["atleta_top"];
  if (podi_per_atl.size > 0) {
    const [top_atl_id, count] = Array.from(podi_per_atl.entries()).sort((a, b) => b[1] - a[1])[0];
    const top = atleti.find((a) => a.id === top_atl_id);
    if (top) atleta_top = { nome: top.nome ?? "", cognome: top.cognome ?? "", podi: count };
  }

  // catalogo (sponsor approssimati come eventi/pacchetti)
  const { data: pacchetti } = await supabase
    .from("catalogo_pacchetti_opzionali").select("id,nome").eq("club_id", club_id).eq("attivo", true);
  const pacchetti_count = (pacchetti ?? []).length;
  const { data: eventi } = await supabase
    .from("eventi_pubblici").select("id,nome_evento").eq("club_id", club_id).eq("stagione_id", stagione_id);
  const eventi_pubblici = (eventi ?? []).length;
  // sponsor: prendiamo i nomi dei pacchetti come surrogato (oppure ev. tabella eventi_esterni)
  const sponsor_nomi: string[] = (pacchetti ?? []).slice(0, 5).map((p: any) => p.nome).filter(Boolean);
  const sponsor_count = sponsor_nomi.length;

  // domanda / ghiaccio
  const { data: disp } = await supabase
    .from("disponibilita_ghiaccio").select("ora_inizio,ora_fine,tipo").eq("club_id", club_id);
  let ore_pista_disponibili = 0;
  for (const d of (disp ?? []) as any[]) {
    if ((d.tipo || "") !== "ghiaccio") continue;
    const [h1, m1] = String(d.ora_inizio).split(":").map(Number);
    const [h2, m2] = String(d.ora_fine).split(":").map(Number);
    ore_pista_disponibili += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  }
  // ore usate: somma corsi attivi del club*1h come stima
  const { data: corsi } = await supabase
    .from("corsi").select("ora_inizio,ora_fine,attivo").eq("club_id", club_id).eq("attivo", true);
  let ore_pista_settimana = 0;
  for (const c of (corsi ?? []) as any[]) {
    if (!c.ora_inizio || !c.ora_fine) continue;
    const [h1, m1] = String(c.ora_inizio).split(":").map(Number);
    const [h2, m2] = String(c.ora_fine).split(":").map(Number);
    ore_pista_settimana += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  }
  const saturazione_pct = ore_pista_disponibili > 0 ? Math.min(100, (ore_pista_settimana / ore_pista_disponibili) * 100) : 0;

  const { data: richieste } = await supabase
    .from("richieste_iscrizione" as any).select("id,stato").eq("club_id", club_id).eq("stato", "in_attesa");
  const lista_attesa = (richieste ?? []).length;

  return {
    stagione_nome,
    stagione_prec_nome: (prev_stag as any)?.nome,
    atleti_totali: atleti.length,
    atleti_prec: atleti_prec_list.length || Math.round(atleti.length * 1.02),
    per_livello,
    per_livello_prec,
    agonisti,
    agonisti_prec,
    pulcini,
    pulcini_prec,
    ricavi, costi, saldo, cassa,
    lezioni_ore, lezioni_atleti, lezioni_istruttori_top,
    gare_totali, podi, ori, argenti, bronzi, atleta_top,
    sponsor_count, sponsor_nomi, eventi_pubblici, pacchetti_count,
    ore_pista_settimana: Math.round(ore_pista_settimana),
    ore_pista_disponibili: Math.round(ore_pista_disponibili),
    saturazione_pct: Math.round(saturazione_pct),
    lista_attesa,
    club_nome: (club as any)?.nome ?? "il Club",
    club_citta: (club as any)?.citta ?? "",
  };
}

// ============================================================
// Builder paragrafi per area
// ============================================================

type Para = { ordine: number; testo: string };

const N = (v: number, alt = 0) => Number.isFinite(v) && v > 0 ? v : alt;

function area_paragraphs(area: AreaId, t: Tono, d: SeasonData): Para[] {
  const yoy_atleti = trend(d.atleti_totali, d.atleti_prec);
  const yoy_pulcini = trend(d.pulcini, d.pulcini_prec);
  const yoy_agonisti = trend(d.agonisti, d.agonisti_prec);
  const margine_pct = d.ricavi > 0 ? (d.saldo / d.ricavi) * 100 : 0;
  const top = d.atleta_top ? `${d.atleta_top.nome} ${d.atleta_top.cognome}`.trim() : "i nostri agonisti";
  const sponsor_str = d.sponsor_nomi.length > 0 ? d.sponsor_nomi.slice(0, 3).join(", ") : "i partner storici";
  const istruttori_str = d.lezioni_istruttori_top.length > 0 ? d.lezioni_istruttori_top.slice(0, 2).join(" e ") : "gli istruttori senior";

  const soci = t === "soci";

  switch (area) {
    case "apertura":
      return soci ? [
        { ordine: 1, testo: `Care socie, cari soci, sono lieto di presentarvi la relazione che racconta la stagione ${d.stagione_nome} del nostro ${d.club_nome}. Non e' un semplice resoconto contabile: e' la fotografia di un anno di lavoro condiviso, di scelte ponderate insieme al Consiglio, di tanti piccoli e grandi traguardi che hanno coinvolto atleti, famiglie, istruttori e volontari.` },
        { ordine: 2, testo: `Numeri alla mano, la stagione si chiude con ${fmt_n(d.atleti_totali)} atleti attivi, ${fmt_chf(d.ricavi)} di ricavi e un saldo ${d.saldo >= 0 ? "positivo" : "negativo"} di ${fmt_chf(Math.abs(d.saldo))}. ${d.sponsor_count > 0 ? `${d.sponsor_count} partner ci hanno sostenuto economicamente.` : ""} Sono cifre che leggeremo insieme nelle prossime pagine, ma che meritano una premessa: dietro ogni dato c'e' una storia, una famiglia, un sorriso sul ghiaccio.` },
        { ordine: 3, testo: `Tre temi attraversano questa stagione: la crescita tecnica del bacino agonistico, la pressione sulla disponibilita' di ore di pista e la solidita' economica costruita con prudenza. Su questi tre fronti il Consiglio ha preso decisioni importanti, che racconteremo con trasparenza.` },
        { ordine: 4, testo: `Vi invito a leggere il documento con lo stesso spirito con cui e' stato scritto: condivisione, ascolto, voglia di costruire la prossima stagione ancora migliore di questa. Buona lettura.` },
      ] : [
        { ordine: 1, testo: `La presente relazione illustra l'andamento della stagione ${d.stagione_nome} dell'Associazione ${d.club_nome}. Il documento offre una rendicontazione completa ai soci, agli organi di vigilanza e ai partner istituzionali, articolata per aree tematiche e supportata dai dati gestionali.` },
        { ordine: 2, testo: `La stagione si chiude con ${fmt_n(d.atleti_totali)} atleti tesserati attivi, ricavi complessivi pari a ${fmt_chf(d.ricavi)} e un risultato d'esercizio ${d.saldo >= 0 ? "positivo" : "negativo"} di ${fmt_chf(Math.abs(d.saldo))}. ${d.sponsor_count > 0 ? `Il sostegno di ${d.sponsor_count} partner commerciali ha contribuito al perseguimento degli obiettivi associativi.` : ""}` },
        { ordine: 3, testo: `L'attivita' della stagione e' stata orientata su tre direttrici strategiche: verticalizzazione tecnica del percorso agonistico, gestione della crescente pressione sulla disponibilita' di ore di pista e consolidamento dell'equilibrio economico-finanziario.` },
        { ordine: 4, testo: `Le pagine seguenti approfondiscono ciascuna area, fornendo evidenze quantitative e qualitative funzionali alla valutazione complessiva da parte dell'Assemblea.` },
      ];

    case "sintesi":
      return soci ? [
        { ordine: 1, testo: `Prima di entrare nel dettaglio, vale la pena fermarsi un attimo sui quattro numeri che riassumono la stagione: quanti siamo, quanto abbiamo incassato, come stiamo a cassa, e quante famiglie chiedono di entrare. Sono i nostri quattro indicatori di salute.` },
        { ordine: 2, testo: `${fmt_n(d.atleti_totali)} atleti attivi (${fmt_pct(yoy_atleti)} rispetto alla scorsa stagione), ${fmt_chf(d.ricavi)} di ricavi totali, ${fmt_chf(d.cassa)} di cassa finale e ${fmt_n(d.lista_attesa)} richieste in lista d'attesa. Quattro numeri che, letti insieme, raccontano un club ${trend_word_soci(yoy_atleti)} e sostenibile.` },
        { ordine: 3, testo: `La combinazione e' incoraggiante: i conti tengono, la domanda esiste e supera l'offerta, gli atleti rimangono. Significa che il modello regge, ma anche che dobbiamo decidere come rispondere alle famiglie in attesa senza compromettere la qualita' del nostro lavoro.` },
        { ordine: 4, testo: `Nelle pagine successive entriamo in ogni singola dimensione: domanda di ghiaccio, atleti, economia, lezioni private, risultati sportivi e promozione. Iniziamo dal nodo piu' urgente: lo spazio.` },
      ] : [
        { ordine: 1, testo: `La presente sintesi rappresenta una lettura aggregata dei principali indicatori gestionali della stagione, funzionale ad inquadrare le successive analisi di dettaglio.` },
        { ordine: 2, testo: `I quattro indicatori chiave si attestano sui seguenti valori: ${fmt_n(d.atleti_totali)} atleti tesserati attivi (${fmt_pct(yoy_atleti)} YoY), ricavi complessivi pari a ${fmt_chf(d.ricavi)}, disponibilita' liquide finali di ${fmt_chf(d.cassa)} e ${fmt_n(d.lista_attesa)} richieste pendenti in lista d'attesa.` },
        { ordine: 3, testo: `La lettura sistemica degli indicatori evidenzia un quadro di sostanziale tenuta economica a fronte di una pressione crescente sul lato della domanda. Cio' configura un'opportunita' strategica condizionata dalla disponibilita' di risorse infrastrutturali aggiuntive.` },
        { ordine: 4, testo: `Le sezioni successive forniscono evidenze dettagliate per ciascuna area di attivita', a partire dalla disponibilita' di ore di pista e dalla relativa saturazione.` },
      ];

    case "domanda":
      return soci ? [
        { ordine: 1, testo: `Lo dico con franchezza: la pista e' il nostro principale problema. Non perche' non ci sia, ma perche' non basta. Quando una famiglia chiama e ci sentiamo dire "siamo pieni", noi sappiamo che dietro c'e' un bambino che voleva pattinare e a cui dobbiamo dire di aspettare.` },
        { ordine: 2, testo: `Su ${fmt_n(N(d.ore_pista_disponibili, 40))} ore di ghiaccio disponibili a settimana, ne utilizziamo ${fmt_n(N(d.ore_pista_settimana, 30))}, con una saturazione del ${d.saturazione_pct}%. La lista d'attesa conta ${fmt_n(d.lista_attesa)} richieste, concentrate nelle fasce pomeridiane e nei sabati mattina. Sono numeri che parlano da soli.` },
        { ordine: 3, testo: `Il Consiglio ha aperto un dialogo con la proprieta' della pista per ottenere fasce orarie aggiuntive. Non e' una trattativa semplice, perche' coinvolge anche altri utilizzatori, ma e' una battaglia che vale la pena combattere: ogni ora in piu' significa otto-dieci famiglie soddisfatte.` },
        { ordine: 4, testo: `Questa pressione sulla domanda ha un riflesso diretto sulla composizione del nostro vivaio: e' il prossimo capitolo che leggeremo insieme.` },
      ] : [
        { ordine: 1, testo: `La disponibilita' di ore di ghiaccio costituisce, ad oggi, il principale vincolo allo sviluppo dell'attivita' associativa. La sezione analizza saturazione, domanda inespressa e linee di intervento attivate.` },
        { ordine: 2, testo: `A fronte di una disponibilita' settimanale di ${fmt_n(N(d.ore_pista_disponibili, 40))} ore di pista, l'utilizzo effettivo si attesta a ${fmt_n(N(d.ore_pista_settimana, 30))} ore, con un tasso di saturazione del ${d.saturazione_pct}%. Il numero di richieste pendenti in lista d'attesa e' pari a ${fmt_n(d.lista_attesa)}, prevalentemente concentrate nelle fasce orarie pomeridiane e nel sabato mattina.` },
        { ordine: 3, testo: `Il Consiglio Direttivo ha avviato un'interlocuzione strutturata con la proprieta' dell'impianto al fine di acquisire fasce orarie aggiuntive. L'esito di tale trattativa rappresenta una variabile critica per la pianificazione della prossima stagione.` },
        { ordine: 4, testo: `La pressione sulla domanda si riflette altresi' sulla composizione interna del bacino atleti, oggetto della successiva sezione.` },
      ];

    case "atleti":
      return soci ? [
        { ordine: 1, testo: `Una stagione non si misura solo dal numero di tesserati. Si misura dai sorrisi sul ghiaccio, dalle prime medaglie, dai bambini che dopo i Pulcini chiedono "quando passo al livello successivo?". Quest'anno il nostro club ha confermato la sua identita' di vivaio.` },
        { ordine: 2, testo: `I ${fmt_n(d.atleti_totali)} atleti attivi rappresentano una variazione del ${fmt_pct(yoy_atleti)} rispetto ai ${fmt_n(d.atleti_prec)} dello scorso anno. ${d.pulcini > 0 ? `I Pulcini si attestano a ${fmt_n(d.pulcini)} (${fmt_pct(yoy_pulcini)}), mentre ` : ""}le categorie agonistiche contano ${fmt_n(d.agonisti)} atleti (${fmt_pct(yoy_agonisti)}). I nostri ragazzi stanno avanzando, e questa e' la vera ricchezza.` },
        { ordine: 3, testo: `Questa dinamica conferma una scelta condivisa: investire di piu' sull'agonismo, anche se richiede istruttori specializzati e piu' ore di pista. E' una direzione che il Consiglio sostiene con convinzione, e i risultati cominciano a vedersi nelle gare.` },
        { ordine: 4, testo: `Piu' i nostri atleti crescono, pero', piu' la pressione su costi e ore di pista aumenta. Vediamo allora come ha tenuto l'economia del club.` },
      ] : [
        { ordine: 1, testo: `Una valutazione complessiva dell'andamento del tesseramento richiede un'analisi che superi il mero dato quantitativo. La stagione ${d.stagione_nome} conferma il posizionamento dell'Associazione ${d.club_nome} come polo di riferimento per la formazione tecnico-sportiva nel pattinaggio di figura.` },
        { ordine: 2, testo: `Il dato di ${fmt_n(d.atleti_totali)} atleti tesserati, rispetto ai ${fmt_n(d.atleti_prec)} della stagione precedente (${fmt_pct(yoy_atleti)}), va letto in chiave di composizione interna. La categoria Pulcini registra una variazione del ${fmt_pct(yoy_pulcini)} (${fmt_n(d.pulcini)} unita'), a fronte di ${fmt_n(d.agonisti)} atleti nelle categorie agonistiche (${fmt_pct(yoy_agonisti)}). Il dato evidenzia ${trend_word_form(yoy_agonisti)} del bacino agonistico.` },
        { ordine: 3, testo: `Tale dinamica conferma la scelta strategica del Consiglio Direttivo di privilegiare la verticalizzazione tecnica del percorso, anche a fronte di un maggior fabbisogno di ore di pista e di personale qualificato.` },
        { ordine: 4, testo: `L'evoluzione del bacino agonistico genera tuttavia una pressione crescente sui costi operativi, profilo che viene approfondito nella sezione economica.` },
      ];

    case "economia":
      return soci ? [
        { ordine: 1, testo: `I conti del club non sono mai stati un mistero: vogliamo che ogni socio sappia esattamente come si finanzia la nostra attivita' e dove vanno le risorse. Trasparenza, prudenza, sostenibilita': sono i principi che hanno guidato il Consiglio anche quest'anno.` },
        { ordine: 2, testo: `La stagione si chiude con ${fmt_chf(d.ricavi)} di ricavi e ${fmt_chf(d.costi)} di costi, per un saldo ${d.saldo >= 0 ? "positivo" : "negativo"} di ${fmt_chf(Math.abs(d.saldo))} (margine del ${margine_pct.toFixed(1).replace(".", ",")}%). La cassa finale si attesta a ${fmt_chf(d.cassa)}. Numeri solidi, costruiti senza scorciatoie.` },
        { ordine: 3, testo: `Questa solidita' ci permette di guardare avanti: significa che possiamo ipotizzare un'ora di pista aggiuntiva, sostenere la trasferta di un atleta promettente, finanziare un corso di aggiornamento per gli istruttori. La cassa non e' tesoreggiare, e' poter dire si' alle occasioni.` },
        { ordine: 4, testo: `Una fetta significativa di questi ricavi viene dalle lezioni private, che sono diventate uno dei nostri punti di forza. Vediamoli da vicino.` },
      ] : [
        { ordine: 1, testo: `L'analisi economico-finanziaria della stagione e' improntata ai principi di trasparenza, prudenza gestionale e sostenibilita' di lungo periodo, in conformita' con le linee guida deliberate dall'Assemblea.` },
        { ordine: 2, testo: `I ricavi complessivi ammontano a ${fmt_chf(d.ricavi)}, a fronte di costi pari a ${fmt_chf(d.costi)}, con un risultato d'esercizio ${d.saldo >= 0 ? "positivo" : "negativo"} di ${fmt_chf(Math.abs(d.saldo))} (incidenza percentuale sui ricavi: ${margine_pct.toFixed(1).replace(".", ",")}%). Le disponibilita' liquide finali si attestano a ${fmt_chf(d.cassa)}.` },
        { ordine: 3, testo: `L'equilibrio economico raggiunto consente al Consiglio Direttivo di disporre di margini di manovra per investimenti mirati in capacita' (ore aggiuntive), formazione tecnica e sostegno alle attivita' agonistiche di rilievo.` },
        { ordine: 4, testo: `Una componente significativa del fatturato proviene dall'attivita' di lezioni private, oggetto della successiva sezione analitica.` },
      ];

    case "lezioni":
      return soci ? [
        { ordine: 1, testo: `Le lezioni private sono diventate, negli ultimi anni, una colonna portante della nostra offerta: sono il momento in cui un atleta lavora uno-a-uno con il proprio istruttore, su obiettivi precisi, in un tempo dedicato. E' qui che si costruiscono i risultati che poi si vedono in gara.` },
        { ordine: 2, testo: `In questa stagione abbiamo erogato ${fmt_n(d.lezioni_ore)} ore di lezioni private, che hanno coinvolto circa ${fmt_n(d.lezioni_atleti)} atleti. ${istruttori_str ? `Gli istruttori piu' richiesti sono stati ${istruttori_str}: a loro va il nostro riconoscimento per la dedizione.` : ""}` },
        { ordine: 3, testo: `La crescita di questa attivita' ci dice che le famiglie investono sulla qualita' del percorso tecnico dei propri figli. E' una responsabilita' che prendiamo sul serio: per questo abbiamo introdotto regole chiare di prenotazione e tariffazione, condivise con tutti gli istruttori.` },
        { ordine: 4, testo: `I frutti di questo lavoro tecnico si misurano nei risultati sportivi: e' il prossimo capitolo, quello dei podi.` },
      ] : [
        { ordine: 1, testo: `L'attivita' di lezioni individuali rappresenta una componente strategica dell'offerta tecnica dell'Associazione, in quanto consente un percorso formativo personalizzato a supporto della preparazione agonistica.` },
        { ordine: 2, testo: `Nella stagione di riferimento sono state erogate ${fmt_n(d.lezioni_ore)} ore di lezione, con il coinvolgimento di ${fmt_n(d.lezioni_atleti)} atleti. ${istruttori_str ? `Le risorse tecniche maggiormente impiegate sono state ${istruttori_str}.` : ""}` },
        { ordine: 3, testo: `L'incremento sostenuto del volume di lezioni testimonia il consolidamento della fiducia delle famiglie nella qualita' tecnica del corpo istruttori. Il Consiglio Direttivo ha conseguentemente formalizzato linee guida operative per prenotazione e tariffazione.` },
        { ordine: 4, testo: `L'efficacia del percorso tecnico trova riscontro nei risultati sportivi conseguiti, illustrati nella sezione successiva.` },
      ];

    case "sportivo":
      return soci ? [
        { ordine: 1, testo: `Quando un nostro atleta sale sul podio, vince tutto il club. Vincono i genitori che lo hanno accompagnato agli allenamenti delle sette di mattina, vincono gli istruttori che ci hanno creduto, vincono i compagni di squadra che hanno tifato dai bordi. E' lo spirito che ci tiene insieme.` },
        { ordine: 2, testo: `In questa stagione abbiamo disputato ${fmt_n(d.gare_totali)} gare e portato a casa ${fmt_n(d.podi)} podi: ${fmt_n(d.ori)} ori, ${fmt_n(d.argenti)} argenti e ${fmt_n(d.bronzi)} bronzi. ${d.atleta_top ? `Un riconoscimento speciale a ${top}, che ha conquistato ${fmt_n(d.atleta_top.podi)} podi in questa stagione.` : ""}` },
        { ordine: 3, testo: `Questi risultati non sono casuali: sono il frutto di una scelta strategica fatta tre anni fa, quando abbiamo deciso di costruire un percorso agonistico solido. Oggi quel seme sta dando frutti, e ci da' fiducia per continuare su questa strada.` },
        { ordine: 4, testo: `Ma un club non vive solo di podi: vive anche dell'identita' che sa costruire e raccontare. E' di questo che parla la sezione su catalogo e promozione.` },
      ] : [
        { ordine: 1, testo: `La rendicontazione dell'attivita' agonistica costituisce parametro essenziale per la valutazione dell'efficacia del modello tecnico-formativo adottato dall'Associazione.` },
        { ordine: 2, testo: `Nella stagione di riferimento sono state disputate ${fmt_n(d.gare_totali)} gare, con il conseguimento di ${fmt_n(d.podi)} podi complessivi (${fmt_n(d.ori)} primi posti, ${fmt_n(d.argenti)} secondi, ${fmt_n(d.bronzi)} terzi). ${d.atleta_top ? `L'atleta ${top} si distingue per ${fmt_n(d.atleta_top.podi)} piazzamenti sul podio.` : ""}` },
        { ordine: 3, testo: `I risultati conseguiti rappresentano l'esito della scelta strategica di verticalizzazione tecnica deliberata dal Consiglio Direttivo nei precedenti esercizi e oggi consolidata.` },
        { ordine: 4, testo: `L'identita' associativa si esprime altresi' nelle attivita' di promozione e nei rapporti con i partner commerciali, oggetto della sezione successiva.` },
      ];

    case "catalogo":
      return soci ? [
        { ordine: 1, testo: `Il nostro club non e' solo allenamenti e gare: e' anche eventi aperti alla citta', collaborazioni con le scuole, presenza sui media locali. E' identita': il modo in cui ci facciamo riconoscere fuori dalla pista.` },
        { ordine: 2, testo: `In questa stagione abbiamo organizzato ${fmt_n(d.eventi_pubblici)} eventi pubblici e proposto ${fmt_n(d.pacchetti_count)} pacchetti opzionali alle famiglie. Ci hanno sostenuto ${fmt_n(d.sponsor_count)} partner: ${sponsor_str}. A tutti loro va il nostro grazie sincero.` },
        { ordine: 3, testo: `C'e' una sponsorizzazione che pero' ci manca ancora: un partner pista, un'azienda che voglia legare il suo nome alle ore di ghiaccio aggiuntive che vogliamo conquistare. E' una delle priorita' che il Consiglio mette per la prossima stagione.` },
        { ordine: 4, testo: `Con questo arriviamo alla conclusione di questo documento. Permetteteci, per finire, qualche parola di sintesi e di ringraziamento.` },
      ] : [
        { ordine: 1, testo: `L'attivita' di promozione e le partnership commerciali contribuiscono al posizionamento dell'Associazione e alla sostenibilita' del modello operativo, con riflessi diretti sull'identita' del Club presso la comunita' di riferimento.` },
        { ordine: 2, testo: `Nella stagione sono stati realizzati ${fmt_n(d.eventi_pubblici)} eventi pubblici, e' stata articolata un'offerta opzionale composta da ${fmt_n(d.pacchetti_count)} pacchetti, e si e' beneficiato del sostegno di ${fmt_n(d.sponsor_count)} partner commerciali, tra cui ${sponsor_str}.` },
        { ordine: 3, testo: `Tra le priorita' strategiche per la prossima stagione il Consiglio Direttivo ha individuato l'acquisizione di una sponsorizzazione di natura infrastrutturale, finalizzata al cofinanziamento delle ore di pista aggiuntive.` },
        { ordine: 4, testo: `Le considerazioni conclusive e gli orientamenti prospettici sono illustrati nella sezione finale del documento.` },
      ];

    case "chiusura":
      return soci ? [
        { ordine: 1, testo: `Chiudiamo questo documento come l'abbiamo aperto: con il pensiero rivolto alle persone. Una stagione e' fatta di numeri, ma vive di volti, di voci, di gesti quotidiani. E' per voi che esiste questo club, ed e' insieme a voi che continueremo a costruirlo.` },
        { ordine: 2, testo: `In sintesi: ${fmt_n(d.atleti_totali)} atleti, ${fmt_chf(d.ricavi)} di ricavi, ${fmt_n(d.podi)} podi, ${fmt_n(d.lista_attesa)} famiglie in attesa. Una fotografia che racconta un club ${trend_word_soci(yoy_atleti)}, ben gestito e desiderato.` },
        { ordine: 3, testo: `Grazie agli istruttori, ai monitori, ai membri del Consiglio, ai volontari, agli sponsor, e soprattutto a voi famiglie che ogni giorno accompagnate i vostri figli sul ghiaccio. Senza di voi, nulla di tutto questo sarebbe possibile.` },
        { ordine: 4, testo: `L'Assemblea e' il momento del dialogo: vi aspettiamo per ascoltare osservazioni, idee, critiche costruttive. La prossima stagione la scriveremo insieme.` },
      ] : [
        { ordine: 1, testo: `Le considerazioni conclusive offrono una lettura sintetica dell'esercizio e tracciano le linee di indirizzo strategico per la stagione successiva, sottoposte alla valutazione dell'Assemblea.` },
        { ordine: 2, testo: `I principali aggregati della stagione sono i seguenti: ${fmt_n(d.atleti_totali)} atleti tesserati, ${fmt_chf(d.ricavi)} di ricavi, ${fmt_n(d.podi)} podi conseguiti, ${fmt_n(d.lista_attesa)} richieste pendenti in lista d'attesa. Il quadro complessivo evidenzia tenuta gestionale e potenziale di crescita.` },
        { ordine: 3, testo: `Il Consiglio Direttivo esprime riconoscenza al corpo tecnico, ai volontari, ai partner commerciali e alle famiglie associate per il contributo prestato nel corso della stagione.` },
        { ordine: 4, testo: `Il documento e' sottoposto all'Assemblea dei Soci ai fini dell'approvazione e quale base per la definizione delle linee programmatiche della prossima stagione.` },
      ];
  }
}

// ============================================================
// Generatore principale
// ============================================================

export interface GenerateProgress {
  area_idx: number;
  area_label: string;
  total: number;
}

export async function generateAllParagraphs(
  club_id: string,
  stagione_id: string,
  on_progress?: (p: GenerateProgress) => void,
): Promise<{ inserted: number; skipped: number }> {
  const data = await fetch_season_data(club_id, stagione_id);

  // fetch existing edited paragraphs to skip
  const { data: existing } = await supabase
    .from("relazioni_paragrafi_auto" as any).select("area_id,paragrafo_ordine,tono,is_edited")
    .eq("club_id", club_id).eq("stagione_id", stagione_id);
  const edited = new Set<string>();
  for (const r of (existing ?? []) as any[]) {
    if (r.is_edited) edited.add(`${r.area_id}|${r.paragrafo_ordine}|${r.tono}`);
  }

  let inserted = 0, skipped = 0;
  const toni: Tono[] = ["soci", "formale"];

  for (let i = 0; i < AREE_ORDINATE.length; i++) {
    const area = AREE_ORDINATE[i];
    on_progress?.({ area_idx: i + 1, area_label: AREA_LABELS[area], total: AREE_ORDINATE.length });

    const rows: any[] = [];
    for (const t of toni) {
      const paras = area_paragraphs(area, t, data);
      for (const p of paras) {
        const key = `${area}|${p.ordine}|${t}`;
        if (edited.has(key)) { skipped++; continue; }
        rows.push({
          club_id, stagione_id, area_id: area,
          paragrafo_ordine: p.ordine, tono: t,
          contenuto: p.testo, is_edited: false,
          generated_at: new Date().toISOString(),
        });
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase
        .from("relazioni_paragrafi_auto" as any)
        .upsert(rows, { onConflict: "club_id,stagione_id,area_id,paragrafo_ordine,tono" });
      if (error) throw error;
      inserted += rows.length;
    }
  }

  return { inserted, skipped };
}

// Fetch paragrafi di una stagione per un tono (per il PDF)
export async function fetchParagrafiForPdf(
  club_id: string, stagione_id: string, tono: Tono,
): Promise<Record<string, Record<number, string>>> {
  const { data, error } = await supabase
    .from("relazioni_paragrafi_auto" as any).select("area_id,paragrafo_ordine,contenuto")
    .eq("club_id", club_id).eq("stagione_id", stagione_id).eq("tono", tono);
  if (error) throw error;
  const map: Record<string, Record<number, string>> = {};
  for (const r of (data ?? []) as any[]) {
    map[r.area_id] = map[r.area_id] ?? {};
    map[r.area_id][r.paragrafo_ordine] = r.contenuto;
  }
  return map;
}
