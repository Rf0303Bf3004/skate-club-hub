// Voce narrante deterministica per la Dashboard Presidente.
// Funzioni pure: stesso input → stesso output.

export type Tone = "positive" | "neutral" | "concerning";

export type AreaNarration = {
  short: string;
  long: string;
  tone: Tone;
};

const pct = (curr: number, prev: number): number => {
  if (!prev) return 0;
  return ((curr - prev) / prev) * 100;
};

const toneFromDelta = (delta: number, invert = false): Tone => {
  const d = invert ? -delta : delta;
  if (d > 5) return "positive";
  if (d < -5) return "concerning";
  return "neutral";
};

const fmt_chf = (n: number) =>
  new Intl.NumberFormat("it-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n || 0);

const fmt_int = (n: number) => new Intl.NumberFormat("it-CH").format(Math.round(n || 0));

// ─── 1. Domanda & Ghiaccio ──────────────────────────────────────────
export function narrateDomanda(input: {
  ore_disponibili: number;
  ore_utilizzate: number;
  ore_richieste: number;
  lista_attesa: number;
  ricavo_potenziale_per_atleta: number;
}): AreaNarration {
  const { ore_disponibili, ore_richieste, lista_attesa, ricavo_potenziale_per_atleta } = input;
  const oreExtra = Math.max(0, ore_richieste - ore_disponibili);
  const ricaviPotenziali = lista_attesa * ricavo_potenziale_per_atleta;
  const tone: Tone = lista_attesa > 50 ? "concerning" : lista_attesa > 20 ? "neutral" : "positive";

  const short =
    lista_attesa > 0
      ? `Mancano ${oreExtra}h di ghiaccio per accogliere tutta la lista d'attesa: +${fmt_chf(ricaviPotenziali)} di ricavi potenziali.`
      : `Capacità ben gestita: nessun atleta in lista d'attesa.`;

  const long =
    `Con ${ore_disponibili}h di ghiaccio settimanale rispondiamo a ${input.ore_utilizzate}h di domanda effettiva, ` +
    `ma le richieste reali sarebbero ${ore_richieste}h. ` +
    (lista_attesa > 0
      ? `Restano ${lista_attesa} atleti in lista d'attesa: serve ${oreExtra}h di pista in più per non perderli, e questo libererebbe ~${fmt_chf(ricaviPotenziali)} di ricavi.`
      : `Il club soddisfa tutta la domanda: situazione di equilibrio.`);

  return { short, long, tone };
}

// ─── 2. Atleti ──────────────────────────────────────────────────────
export function narrateAtleti(input: {
  total: number;
  prevTotal: number;
  livelli_curr: Record<string, number>;
  livelli_prev: Record<string, number>;
  eta_media: number;
}): AreaNarration {
  const { total, prevTotal, livelli_curr, livelli_prev, eta_media } = input;
  const delta = pct(total, prevTotal);
  const tone = toneFromDelta(delta);

  // trova il livello con maggior crescita e maggior calo
  const diffs = Object.keys(livelli_curr).map((k) => ({
    nome: k,
    diff: (livelli_curr[k] || 0) - (livelli_prev[k] || 0),
  }));
  const grow = diffs.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff)[0];
  const drop = diffs.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff)[0];

  let short: string;
  if (grow && drop) {
    short = `${drop.nome} cala (${drop.diff}), ${grow.nome} cresce (+${grow.diff}): i ragazzi avanzano verso l'agonismo.`;
  } else if (grow) {
    short = `${grow.nome} cresce (+${grow.diff}): segno di un livello in salute.`;
  } else if (drop) {
    short = `${drop.nome} in calo (${drop.diff}): occhio alla retention dei piccoli.`;
  } else {
    short = `Distribuzione livelli stabile, eta media ${eta_media.toFixed(1)} anni.`;
  }

  const long =
    `Il club conta ${fmt_int(total)} atleti attivi (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% YoY), eta media ${eta_media.toFixed(1)} anni. ` +
    (grow ? `${grow.nome} guida la crescita (+${grow.diff}). ` : "") +
    (drop ? `${drop.nome} mostra il calo piu marcato (${drop.diff}), da monitorare. ` : "") +
    `La piramide resta ${tone === "positive" ? "in espansione" : tone === "concerning" ? "sotto pressione" : "stabile"}.`;

  return { short, long, tone };
}

// ─── 3. Ricavi & Pacchetti ──────────────────────────────────────────
export function narrateRicavi(input: {
  totale: number;
  totale_prev: number;
  per_fonte: Record<string, number>;
  per_fonte_prev: Record<string, number>;
}): AreaNarration {
  const { totale, totale_prev, per_fonte, per_fonte_prev } = input;
  const delta = pct(totale, totale_prev);
  const tone = toneFromDelta(delta);

  const corsi = per_fonte["quote_corsi"] || 0;
  const pctCorsi = totale ? (corsi / totale) * 100 : 0;
  const pack = per_fonte["pacchetti_opzionali"] || 0;
  const packPrev = per_fonte_prev["pacchetti_opzionali"] || 0;
  const dPack = pct(pack, packPrev);

  const short =
    `Le quote corsi pesano per il ${pctCorsi.toFixed(0)}% dei ricavi. I pacchetti opzionali ` +
    (dPack > 5 ? `crescono (+${dPack.toFixed(0)}% YoY).` : dPack < -5 ? `calano (${dPack.toFixed(0)}% YoY).` : `restano stabili.`);

  const long =
    `Ricavi stagione ${fmt_chf(totale)} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% YoY). ` +
    `Le quote corsi rappresentano ${fmt_chf(corsi)} (${pctCorsi.toFixed(0)}% del totale). ` +
    `I pacchetti opzionali generano ${fmt_chf(pack)} ` +
    (dPack > 0 ? `e crescono del ${dPack.toFixed(0)}%: leva da spingere.` : `con un trend del ${dPack.toFixed(0)}%.`);

  return { short, long, tone };
}

// ─── 4. Costi & Istruttori ──────────────────────────────────────────
export function narrateCosti(input: {
  n_istruttori: number;
  costo_totale: number;
  top_istruttore_nome: string;
  top_istruttore_ore: number;
  top_istruttore_margine: number;
}): AreaNarration {
  const { n_istruttori, costo_totale, top_istruttore_nome, top_istruttore_ore, top_istruttore_margine } = input;
  const tone: Tone = top_istruttore_margine > 20 ? "positive" : top_istruttore_margine < 0 ? "concerning" : "neutral";

  const short = top_istruttore_nome
    ? `${top_istruttore_nome} e' il piu' richiesto (${top_istruttore_ore.toFixed(0)} ore vendute), genera margine ${top_istruttore_margine >= 0 ? "positivo" : "negativo"} (${top_istruttore_margine.toFixed(0)}%).`
    : `Costo istruttori stagione ${fmt_chf(costo_totale)}.`;

  const long =
    `Lo staff conta ${n_istruttori} istruttori per un costo totale di ${fmt_chf(costo_totale)} a stagione. ` +
    (top_istruttore_nome
      ? `${top_istruttore_nome} guida il team con ${top_istruttore_ore.toFixed(0)} ore lavorate e un margine del ${top_istruttore_margine.toFixed(0)}%. `
      : "") +
    (tone === "positive" ? "L'efficienza dello staff e' solida." : tone === "concerning" ? "Margini sotto pressione: rivedere il mix ore/tariffe." : "Mix costi/ricavi nella norma.");

  return { short, long, tone };
}

// ─── 5. Lezioni Private ─────────────────────────────────────────────
export function narrateLezioni(input: {
  ore_vendute: number;
  fatturato: number;
  fatturato_prev: number;
  fascia_top: string;
  top_cliente_nome: string;
  top_cliente_ore: number;
}): AreaNarration {
  const { ore_vendute, fatturato, fatturato_prev, fascia_top, top_cliente_nome, top_cliente_ore } = input;
  const delta = pct(fatturato, fatturato_prev);
  const tone = toneFromDelta(delta);

  const short =
    `La fascia ${fascia_top} e' la piu' venduta. ` +
    (top_cliente_nome ? `Top cliente ${top_cliente_nome} (${top_cliente_ore.toFixed(0)} ore).` : `${ore_vendute.toFixed(0)} ore vendute.`);

  const long =
    `Le lezioni private hanno generato ${fmt_chf(fatturato)} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% YoY) su ${ore_vendute.toFixed(0)} ore vendute. ` +
    `La fascia ${fascia_top} concentra la maggior parte della domanda. ` +
    (top_cliente_nome ? `${top_cliente_nome} e' il cliente di punta con ${top_cliente_ore.toFixed(0)} ore.` : "");

  return { short, long, tone };
}

// ─── 6. Sportivo ────────────────────────────────────────────────────
export function narrateSportivo(input: {
  podi: number;
  gare: number;
  podi_prev: number;
  top_atleta_nome: string;
  top_atleta_podi: number;
}): AreaNarration {
  const { podi, gare, podi_prev, top_atleta_nome, top_atleta_podi } = input;
  const delta = pct(podi, podi_prev);
  const tone = toneFromDelta(delta);

  const short = top_atleta_nome
    ? `${top_atleta_nome} e' la nostra atleta di punta. ${podi} ${podi === 1 ? "podio" : "podi"} in ${gare} ${gare === 1 ? "gara" : "gare"}.`
    : `${podi} ${podi === 1 ? "podio" : "podi"} in ${gare} ${gare === 1 ? "gara" : "gare"} disputate.`;

  const long =
    `Stagione sportiva con ${gare} ${gare === 1 ? "gara disputata" : "gare disputate"} e ${podi} ${podi === 1 ? "podio conquistato" : "podi conquistati"} ` +
    `(${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% rispetto allo scorso anno). ` +
    (top_atleta_nome ? `${top_atleta_nome} si conferma la punta del club con ${top_atleta_podi} podi personali. ` : "") +
    (tone === "positive" ? "Il momento agonistico e' in crescita." : tone === "concerning" ? "Trend in flessione: serve ritrovare slancio." : "Risultati in linea con la scorsa stagione.");

  return { short, long, tone };
}

// ─── 7. Catalogo & Promozione ───────────────────────────────────────
export function narrateCatalogoPromozione(input: {
  sponsorCount: number;
  totaleAnnuo: number;
  categorieCercateCount: number;
  topCategoria: string;
  topImporto: number;
  eventiCount: number;
  partecipantiTotali: number;
}): AreaNarration {
  const { sponsorCount, totaleAnnuo, categorieCercateCount, topCategoria, topImporto, eventiCount, partecipantiTotali } = input;
  const tone: Tone = sponsorCount >= 5 ? "positive" : sponsorCount >= 3 ? "neutral" : "concerning";

  const short =
    `${sponsorCount} partner sostengono il club per ${fmt_chf(totaleAnnuo)}. ` +
    (topCategoria ? `Stiamo cercando uno sponsor ${topCategoria} (${fmt_chf(topImporto)}) per coprire le ore aggiuntive.` : `Aperte ${categorieCercateCount} categorie di partnership.`);

  const long =
    `${sponsorCount} sponsor sostengono il club con ${fmt_chf(totaleAnnuo)} annui, mentre cerchiamo partner in ${categorieCercateCount} categorie strategiche. ` +
    (topCategoria ? `La priorità è uno sponsor ${topCategoria} da ~${fmt_chf(topImporto)} per ampliare le ore di ghiaccio. ` : "") +
    `Quest'anno abbiamo organizzato ${eventiCount} ${eventiCount === 1 ? "evento aperto" : "eventi aperti"} alla cittadinanza con oltre ${fmt_int(partecipantiTotali)} persone coinvolte.`;

  return { short, long, tone };
}
