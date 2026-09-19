/**
 * Colonne del modello di importazione/esportazione atleti.
 * UNICA fonte: usate sia da ImportAtletiPage (lettura) sia da AthletesPage
 * (esportazione). Quello che esce si può reimportare così com'è: se si
 * aggiunge o cambia una colonna, si cambia solo qui.
 */

/**
 * `colonna` è la colonna della tabella `atleti` su cui finisce davvero il dato:
 * le etichette devono dire la verità su dove va a scrivere ogni campo.
 */
export const TARGET_FIELDS = [
  { key: "nome",                label_key: "field.nome",                colonna: "nome",                required: true  },
  { key: "cognome",             label_key: "field.cognome",             colonna: "cognome",             required: true  },
  { key: "data_nascita",        label_key: "field.data_nascita",        colonna: "data_nascita",        required: true  },
  { key: "sesso",               label_key: "field.sesso",               colonna: "sesso",               required: false },
  { key: "telefono",            label_key: "field.telefono_atleta",            colonna: "telefono",            required: false },
  { key: "livello",             label_key: "field.livello",             colonna: "livello_attuale",     required: false },
  { key: "categoria",           label_key: "field.categoria",           colonna: "categoria",           required: false },
  { key: "email",               label_key: "field.email_genitore",               colonna: "genitore1_email",     required: false },
  { key: "genitore1_telefono",  label_key: "field.genitore1_telefono",  colonna: "genitore1_telefono",  required: false },
  { key: "genitore1_nome",      label_key: "field.genitore1_nome",      colonna: "genitore1_nome",      required: false },
  { key: "genitore1_cognome",   label_key: "field.genitore1_cognome",   colonna: "genitore1_cognome",   required: false },
  { key: "genitore1_indirizzo", label_key: "field.genitore1_indirizzo", colonna: "genitore1_indirizzo", required: false },
  { key: "genitore1_cap",       label_key: "field.genitore1_cap",       colonna: "genitore1_cap",       required: false },
  { key: "genitore1_citta",     label_key: "field.genitore1_citta",     colonna: "genitore1_citta",     required: false },
  { key: "genitore1_cantone",   label_key: "field.genitore1_cantone",   colonna: "genitore1_cantone",   required: false },
] as const;

export type TargetKey = typeof TARGET_FIELDS[number]["key"];

/** Campi che il modello scaricabile propone, nell'ordine dell'intestazione. */
export const TEMPLATE_HEADERS: Record<TargetKey, string> = {
  nome: "nome",
  cognome: "cognome",
  data_nascita: "data_nascita",
  sesso: "sesso",
  telefono: "telefono",
  livello: "livello",
  categoria: "categoria",
  email: "email genitore",
  genitore1_telefono: "telefono genitore",
  genitore1_nome: "nome genitore",
  genitore1_cognome: "cognome genitore",
  genitore1_indirizzo: "indirizzo",
  genitore1_cap: "cap",
  genitore1_citta: "localita",
  genitore1_cantone: "cantone",
};

export const TEMPLATE_ESEMPIO: Record<TargetKey, string> = {
  nome: "Mario",
  cognome: "Rossi",
  data_nascita: "12.05.2010",
  sesso: "M",
  telefono: "+41791234567",
  livello: "Stellina 2",
  categoria: "amatori",
  email: "famiglia.rossi@example.com",
  genitore1_telefono: "+41791112233",
  genitore1_nome: "Anna",
  genitore1_cognome: "Rossi",
  genitore1_indirizzo: "Via del Ghiaccio 12",
  genitore1_cap: "6900",
  genitore1_citta: "Lugano",
  genitore1_cantone: "TI",
};

/** Da ISO (aaaa-mm-gg) al formato svizzero gg.mm.aaaa del modello. */
export function formatta_data_ch(iso: string | null | undefined): string {
  const s = (iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** Nome file: nome del club ridotto a lettere, numeri e trattini. */
export function nome_file_atleti(club_nome: string | null | undefined): string {
  const base = (club_nome || "club")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "club";
  const oggi = new Date();
  const data = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
  return `atleti-${base}-${data}.xlsx`;
}
