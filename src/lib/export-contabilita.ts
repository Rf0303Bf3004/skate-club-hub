import type { FormatoContabilita } from "@/hooks/use-impostazioni-contabilita";

/** Una registrazione contabile come la restituisce la funzione `esporta_contabilita`. */
export interface RigaContabile {
  data: string;
  numero: string | null;
  data_documento: string | null;
  data_scadenza: string | null;
  descrizione: string | null;
  conto_dare: string | null;
  conto_avere: string | null;
  importo: number | null;
  valuta: string | null;
  codice_iva: string | null;
  aliquota_iva: number | null;
  importo_iva: number | null;
  importo_netto: number | null;
  cliente_nome: string | null;
  riferimento: string | null;
  id_esterno: string | null;
  tipo_riga: string | null;
  ente: string | null;
}

const CRLF = "\r\n";

/** Banana scorpora l'IVA dal codice: la riga porta l'importo lordo. */
export function iva_nella_riga(formato: FormatoContabilita): boolean {
  return formato === "banana";
}

/** Numero con punto decimale e due cifre, senza separatore delle migliaia né valuta. */
function importo_testo(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toFixed(2);
}

/** Da "2026-09-18" (o ISO completa) a "2026-09-18". */
function data_iso(d: string | null | undefined): string {
  if (!d) return "";
  return String(d).slice(0, 10);
}

/** Da "2026-09-18" a "18.09.2026" (formato Crésus). */
function data_punti(d: string | null | undefined): string {
  const iso = data_iso(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, g] = iso.split("-");
  return `${g}.${m}.${y}`;
}

/** Nei file a tabulazioni i separatori dentro il testo romperebbero le colonne. */
function pulisci_tab(s: string | null | undefined): string {
  return String(s ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

/** Virgolette doppie solo se servono, con le virgolette interne raddoppiate. */
function campo_csv(s: string | null | undefined): string {
  const testo = String(s ?? "").replace(/[\r\n]+/g, " ");
  if (testo.includes(";") || testo.includes('"')) {
    return `"${testo.replace(/"/g, '""')}"`;
  }
  return testo;
}

const INTESTAZIONI_BANANA = [
  "Date",
  "Doc",
  "Description",
  "AccountDebit",
  "AccountCredit",
  "Amount",
  "VatCode",
  "DateExpiration",
  "ExternalReference",
];

const INTESTAZIONI_CSV = [
  "Data",
  "NumeroFattura",
  "DataDocumento",
  "DataScadenza",
  "Descrizione",
  "ContoDare",
  "ContoAvere",
  "Importo",
  "Valuta",
  "CodiceIVA",
  "AliquotaIVA",
  "ImportoIVA",
  "ImportoNetto",
  "Cliente",
  "Riferimento",
  "IdEsterno",
  "TipoRiga",
  "Ente",
];

function testo_banana(righe: RigaContabile[]): string {
  const linee = [INTESTAZIONI_BANANA.join("\t")];
  for (const r of righe) {
    linee.push(
      [
        data_iso(r.data),
        pulisci_tab(r.numero),
        pulisci_tab(r.descrizione),
        pulisci_tab(r.conto_dare),
        pulisci_tab(r.conto_avere),
        importo_testo(r.importo),
        pulisci_tab(r.codice_iva),
        data_iso(r.data_scadenza),
        pulisci_tab(r.id_esterno),
      ].join("\t"),
    );
  }
  return linee.join(CRLF) + CRLF;
}

function testo_cresus(righe: RigaContabile[]): string {
  // Crésus non vuole la riga di intestazione.
  const linee = righe.map((r) =>
    [
      data_punti(r.data),
      pulisci_tab(r.conto_dare),
      pulisci_tab(r.conto_avere),
      pulisci_tab(r.numero),
      pulisci_tab(r.descrizione),
      importo_testo(r.importo),
      pulisci_tab(r.codice_iva),
    ].join("\t"),
  );
  return linee.join(CRLF) + (linee.length ? CRLF : "");
}

function testo_csv(righe: RigaContabile[]): string {
  const linee = [INTESTAZIONI_CSV.join(";")];
  for (const r of righe) {
    linee.push(
      [
        data_iso(r.data),
        r.numero,
        data_iso(r.data_documento),
        data_iso(r.data_scadenza),
        r.descrizione,
        r.conto_dare,
        r.conto_avere,
        importo_testo(r.importo),
        r.valuta,
        r.codice_iva,
        r.aliquota_iva == null ? "" : String(r.aliquota_iva),
        importo_testo(r.importo_iva),
        importo_testo(r.importo_netto),
        r.cliente_nome,
        r.riferimento,
        r.id_esterno,
        r.tipo_riga,
        r.ente,
      ]
        .map(campo_csv)
        .join(";"),
    );
  }
  return linee.join(CRLF) + CRLF;
}

export function estensione_formato(formato: FormatoContabilita): string {
  return formato === "csv" ? "csv" : "txt";
}

/** Contenuto del file nel formato scelto. */
export function componi_file(formato: FormatoContabilita, righe: RigaContabile[]): string {
  if (formato === "banana") return testo_banana(righe);
  if (formato === "cresus") return testo_cresus(righe);
  return testo_csv(righe);
}

/** Senza spazi né accenti: va bene per qualsiasi sistema operativo. */
export function nome_file(nome_club: string, dal: string, al: string, formato: FormatoContabilita): string {
  const pulito = (nome_club || "club")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "club";
  return `contabilita_${pulito}_${data_iso(dal)}_${data_iso(al)}.${estensione_formato(formato)}`;
}

/** Scarica il file: il CSV generico ha il BOM, gli altri no. */
export function scarica_file(formato: FormatoContabilita, contenuto: string, nome: string) {
  const con_bom = formato === "csv" ? "\ufeff" + contenuto : contenuto;
  const tipo =
    formato === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([con_bom], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
