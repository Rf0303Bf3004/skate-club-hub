import * as XLSX from "xlsx";

/**
 * Helper condivisi per l'importazione da fogli Excel (anagrafica atleti e
 * atleti ospiti dei campi). Unica fonte di verità: qui e non duplicati.
 */

export function strip_accents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalize_header(s: string): string {
  return strip_accents(String(s || "").trim().toLowerCase()).replace(/[\s._-]+/g, " ");
}

/** Mappatura automatica intestazioni → campi, in base ai sinonimi forniti. */
export function detect_mapping<K extends string>(
  headers: string[],
  synonyms: Record<K, string[]>,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  (Object.keys(synonyms) as K[]).forEach((k) => {
    const syns = synonyms[k].map(normalize_header);
    const found = headers.find((h) => syns.includes(normalize_header(h)));
    if (found) out[k] = found;
  });
  return out;
}

export function build_iso(y: number, mo: number, d: number): string | null {
  const current_year = new Date().getFullYear();
  if (y < 1920 || y > current_year + 5) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Accetta seriali Excel, ISO e formato CH/IT (giorno prima del mese). */
export function parse_date(value: any): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return build_iso(d.y, d.m, d.d);
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return build_iso(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let yy = m[3];
    if (yy.length === 2) yy = (parseInt(yy, 10) > 30 ? "19" : "20") + yy;
    return build_iso(parseInt(yy, 10), parseInt(m[2], 10), parseInt(m[1], 10));
  }
  return null;
}

export function valid_email(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function norm_string(s: any): string {
  return String(s ?? "").trim();
}

export function normalize_sesso(s: any): string {
  const v = norm_string(s).toLowerCase();
  if (["m", "maschio", "male", "uomo", "boy"].includes(v)) return "M";
  if (["f", "femmina", "female", "donna", "girl"].includes(v)) return "F";
  return v.toUpperCase();
}

export function normalize_livello_key(s: any): string {
  let v = strip_accents(String(s ?? "").toLowerCase()).trim();
  v = v.replace(/[._\-,;:/\\]+/g, " ");
  v = v.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  v = v.replace(/\s+/g, " ").trim();
  return v;
}

/** Livello canonico corrispondente all'input (match esatto o token-prefix). */
export function match_livello_canonico(input: string, ufficiali: string[]): string | null {
  const k = normalize_livello_key(input);
  if (!k) return null;
  for (const u of ufficiali) {
    if (normalize_livello_key(u) === k) return u;
  }
  const in_tokens = k.split(" ");
  for (const u of ufficiali) {
    const u_tokens = normalize_livello_key(u).split(" ");
    if (u_tokens.length !== in_tokens.length) continue;
    let ok = true;
    for (let i = 0; i < in_tokens.length; i++) {
      const it = in_tokens[i];
      const ut = u_tokens[i];
      if (it === ut) continue;
      if (/^\d+$/.test(it) || /^\d+$/.test(ut)) { ok = false; break; }
      if (it.length < 3 || !ut.startsWith(it)) { ok = false; break; }
    }
    if (ok) return u;
  }
  return null;
}

export function dup_key(nome: string, cognome: string, data_nascita: string): string {
  return `${nome.toLowerCase()}|${cognome.toLowerCase()}|${data_nascita}`;
}

/** Legge il primo foglio di un file Excel e ritorna intestazioni + righe. */
export async function leggi_foglio(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}
