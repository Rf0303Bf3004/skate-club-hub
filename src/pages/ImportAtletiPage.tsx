import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase, get_current_club_id } from "@/lib/supabase";
import {
  Upload, FileSpreadsheet, Download, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, Home, UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { segnala_errore } from "@/lib/errori";
import { CATEGORIE, get_categoria_label, type Categoria } from "@/lib/atleta-livello";

const ti = (key: string, opts?: any) => i18n.t(`import.${key}`, { ns: "atleti", ...(opts || {}) }) as string;

// ──────────────────────────────────────────────────────────────────
// Tipi & costanti — colonne del modello condivise con l'esportazione
// (src/lib/atleti-colonne.ts è l'unica fonte: non duplicarle qui).
// ──────────────────────────────────────────────────────────────────
import { TARGET_FIELDS, TEMPLATE_HEADERS, TEMPLATE_ESEMPIO, type TargetKey } from "@/lib/atleti-colonne";

const SYNONYMS: Record<TargetKey, string[]> = {
  nome:         ["nome", "name", "first name", "firstname"],
  cognome:      ["cognome", "surname", "last name", "lastname", "family name"],
  data_nascita: ["data nascita", "data di nascita", "datanascita", "birthday", "birthdate", "date of birth", "dob", "nato il"],
  sesso:        ["sesso", "genere", "gender", "sex"],
  email:        ["email", "e-mail", "mail", "posta", "indirizzo email", "email genitore", "mail genitore", "email famiglia"],
  telefono:     ["telefono", "tel", "cell", "cellulare", "phone", "mobile", "numero", "telefono atleta"],
  livello:      ["livello", "level", "livello attuale"],
  categoria:    ["categoria", "category", "categorie"],
  genitore1_telefono:  ["telefono genitore", "tel genitore", "cellulare genitore", "telefono mamma", "telefono papa", "parent phone"],
  genitore1_nome:      ["nome genitore", "genitore", "nome mamma", "nome papa", "parent first name", "parent name"],
  genitore1_cognome:   ["cognome genitore", "cognome mamma", "cognome papa", "parent last name", "parent surname"],
  genitore1_indirizzo: ["indirizzo", "via", "strada", "address", "adresse", "strasse", "indirizzo genitore"],
  genitore1_cap:       ["cap", "npa", "codice postale", "plz", "zip", "postal code"],
  genitore1_citta:     ["localita", "luogo", "citta", "comune", "city", "ort", "ville"],
  genitore1_cantone:   ["cantone", "canton", "ct", "kanton"],
};


/** Oltre questa soglia l'anteprima non disegna tutte le righe. */
const SOGLIA_RIGHE = 500;
const RIGHE_ANTEPRIMA = 100;

type RowRecord = Record<string, any>;
type ParsedRow = {
  idx: number;
  raw: RowRecord;
  normalized: Record<TargetKey, string>;
  /** Categoria che verrà scritta (dal file se mappata, altrimenti quella scelta per tutto l'elenco). */
  categoria_finale: string;
  /** Valore originale del livello dal file (mostrato in caso di warning). */
  livello_raw?: string;
  /** True se il livello del file non è stato riconosciuto: import permissivo, livello → NULL. */
  livello_warning?: boolean;
  /** True se la categoria scritta nel file non è riconosciuta: si usa quella generale. */
  categoria_warning?: boolean;
  /** True se una riga nuova non ha l'email del genitore: nessun invito possibile. */
  email_mancante?: boolean;
  errors: string[];
  status: "nuovo" | "aggiornamento" | "errore";
  existing_id?: string;
};

type RigaFallita = { riga: number; nome: string; motivo: string };

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function strip_accents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalize_header(s: string): string {
  return strip_accents(String(s || "").trim().toLowerCase()).replace(/[\s._-]+/g, " ");
}

function detect_mapping(headers: string[]): Partial<Record<TargetKey, string>> {
  const out: Partial<Record<TargetKey, string>> = {};
  const usate = new Set<string>();
  for (const t of TARGET_FIELDS) {
    const syns = SYNONYMS[t.key].map(normalize_header);
    const found = headers.find((h) => !usate.has(h) && syns.includes(normalize_header(h)));
    if (found) { out[t.key] = found; usate.add(found); }
  }
  return out;
}

function build_iso(y: number, mo: number, d: number): string | null {
  // Validazione: data reale + range plausibile (1920..anno corrente)
  const current_year = new Date().getFullYear();
  if (y < 1920 || y > current_year) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parse_date(value: any): string | null {
  if (value == null || value === "") return null;
  // Excel serial number
  if (typeof value === "number" && isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return build_iso(d.y, d.m, d.d);
  }
  const s = String(value).trim();
  // ISO aaaa-mm-gg (separatori . / -, prima parte 4 cifre)
  let m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return build_iso(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  // gg.mm.aaaa / gg/mm/aaaa / gg-mm-aaaa (formato CH/IT — giorno SEMPRE prima del mese)
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let yy = m[3];
    if (yy.length === 2) yy = (parseInt(yy, 10) > 30 ? "19" : "20") + yy;
    return build_iso(parseInt(yy, 10), parseInt(m[2], 10), parseInt(m[1], 10));
  }
  return null;
}

function valid_email(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function norm_string(s: any): string {
  return String(s ?? "").trim();
}

function normalize_sesso(s: any): string {
  const v = norm_string(s).toLowerCase();
  if (["m", "maschio", "male", "uomo", "boy"].includes(v)) return "M";
  if (["f", "femmina", "female", "donna", "girl"].includes(v)) return "F";
  return v.toUpperCase(); // ritorna il valore originale in maiuscolo per validazione
}

/** Riconosce la categoria scritta nel file. Ritorna null se non riconosciuta. */
function match_categoria(input: string): Categoria | null {
  const v = strip_accents(norm_string(input).toLowerCase());
  if (!v) return null;
  if (["pulcini", "pulcino", "minis", "mini"].includes(v)) return "pulcini";
  if (["amatori", "amatoriale", "amatore", "hobby", "loisir"].includes(v)) return "amatori";
  if (["artistica", "agonistica", "agoniste", "agonisti", "competizione"].includes(v)) return "artistica";
  return null;
}

/**
 * Normalizza una stringa livello per il matching:
 *  - strip accenti, lowercase, trim
 *  - punteggiatura → spazio
 *  - inserisce spazio fra lettere e cifre (es. "stellina1" → "stellina 1")
 *  - collassa spazi multipli
 */
function normalize_livello_key(s: any): string {
  let v = strip_accents(String(s ?? "").toLowerCase()).trim();
  v = v.replace(/[._\-,;:/\\]+/g, " ");
  v = v.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  v = v.replace(/\s+/g, " ").trim();
  return v;
}

/**
 * Trova il livello canonico ufficiale che corrisponde al valore in input.
 * Match: uguaglianza esatta normalizzata, oppure token-prefix
 * (es. "stell 1" → "stellina 1": ogni token input è prefisso del corrispondente canonico).
 * Ritorna il nome canonico (case originale del DB) oppure null.
 */
function match_livello_canonico(input: string, ufficiali: string[]): string | null {
  const k = normalize_livello_key(input);
  if (!k) return null;
  // 1) match esatto normalizzato
  for (const u of ufficiali) {
    if (normalize_livello_key(u) === k) return u;
  }
  // 2) match token-prefix
  const in_tokens = k.split(" ");
  for (const u of ufficiali) {
    const u_tokens = normalize_livello_key(u).split(" ");
    if (u_tokens.length !== in_tokens.length) continue;
    let ok = true;
    for (let i = 0; i < in_tokens.length; i++) {
      const it = in_tokens[i];
      const ut = u_tokens[i];
      if (it === ut) continue;
      // se entrambi numerici, devono essere uguali
      if (/^\d+$/.test(it) || /^\d+$/.test(ut)) { ok = false; break; }
      // altrimenti il token input dev'essere prefisso (≥3 char) del canonico
      if (it.length < 3 || !ut.startsWith(it)) { ok = false; break; }
    }
    if (ok) return u;
  }
  return null;
}

function dup_key(nome: string, cognome: string, data_nascita: string): string {
  return `${nome.toLowerCase()}|${cognome.toLowerCase()}|${data_nascita}`;
}

const EMPTY_MAPPING = Object.fromEntries(TARGET_FIELDS.map((t) => [t.key, ""])) as Record<TargetKey, string>;

// ──────────────────────────────────────────────────────────────────
// Step components
// ──────────────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ step: number }> = ({ step }) => {
  const steps = [ti("step.upload"), ti("step.mapping"), ti("step.preview"), ti("step.import")];
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              active ? "bg-primary text-primary-foreground"
              : done ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                active ? "bg-primary-foreground/20" : done ? "bg-primary/20" : "bg-background"
              }`}>{done ? "✓" : n}</span>
              {s}
            </div>
            {i < steps.length - 1 && <div className="w-4 h-px bg-border" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Pagina
// ──────────────────────────────────────────────────────────────────

const ImportAtletiPage: React.FC = () => {
  const { t } = useTranslation("atleti");
  const navigate = useNavigate();
  const query_client = useQueryClient();
  const club_id = get_current_club_id();

  const [step, set_step] = useState<1 | 2 | 3 | 4>(1);
  const [file_name, set_file_name] = useState<string>("");
  const [headers, set_headers] = useState<string[]>([]);
  const [rows, set_rows] = useState<RowRecord[]>([]);
  const [mapping, set_mapping] = useState<Record<TargetKey, string>>(EMPTY_MAPPING);
  const [categoria_generale, set_categoria_generale] = useState<string>("");
  const [parsed, set_parsed] = useState<ParsedRow[]>([]);
  const [importing, set_importing] = useState(false);
  const [progresso, set_progresso] = useState<{ fatte: number; totale: number }>({ fatte: 0, totale: 0 });
  const [report, set_report] = useState<{
    creati: number; aggiornati: number; errori: number; falliti: RigaFallita[];
  } | null>(null);
  const [drag_active, set_drag_active] = useState(false);
  const file_input_ref = useRef<HTMLInputElement>(null);

  // Fetch livelli ufficiali (tabella globale, senza club_id)
  const livelli_query = useQuery({
    queryKey: ["livelli_import"],
    queryFn: async () => {
      const { data, error } = await supabase.from("livelli").select("nome").eq("attivo", true);
      if (error) throw error;
      return (data ?? []).map((l: any) => norm_string(l.nome)).filter(Boolean);
    },
  });
  const livelli_db = livelli_query.data ?? [];
  const livelli_errore = livelli_query.isError;
  const ricarica_livelli = livelli_query.refetch;

  // Fetch atleti del club per match duplicati
  const atleti_query = useQuery({
    queryKey: ["atleti_import_match", club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("id, nome, cognome, data_nascita, telefono, sesso, livello_attuale, categoria, genitore1_email, genitore1_telefono, genitore1_nome, genitore1_cognome, genitore1_indirizzo, genitore1_cap, genitore1_citta, genitore1_cantone")
        .eq("club_id", club_id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const atleti_db = atleti_query.data ?? [];
  const atleti_errore = atleti_query.isError;
  const ricarica_atleti = atleti_query.refetch;
  // La lettura è "pronta" solo se è riuscita davvero: un elenco vuoto per errore
  // classificherebbe tutte le righe come nuove e duplicherebbe l'anagrafica.
  const atleti_pronti = atleti_query.isSuccess;

  // Segnalazione una sola volta a tentativi esauriti, non dentro la queryFn.
  useEffect(() => {
    if (livelli_query.error) {
      void segnala_errore("ImportAtletiPage", ti("toast.livelli_lettura_fallita"), livelli_query.error, undefined, "avviso");
    }
  }, [livelli_query.error]);
  useEffect(() => {
    if (atleti_query.error) {
      void segnala_errore("ImportAtletiPage", ti("toast.atleti_lettura_fallita"), atleti_query.error);
    }
  }, [atleti_query.error]);

  // Avviso alla chiusura della pagina mentre l'importazione è in corso.
  useEffect(() => {
    if (!importing) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [importing]);

  // Solo la lettura degli atleti blocca: i livelli sono facoltativi e degradano con grazia.
  const lettura_fallita = atleti_errore;
  const atleti_index = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of atleti_db as any[]) {
      if (a.nome && a.cognome && a.data_nascita) {
        m.set(dup_key(a.nome, a.cognome, a.data_nascita), a);
      }
    }
    return m;
  }, [atleti_db]);

  // ── STEP 1: file handling ──
  const handle_file = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<RowRecord>(ws, { defval: "", raw: true });
      if (json.length === 0) {
        toast.error(ti("toast.no_rows"));
        return;
      }
      const hdrs = Object.keys(json[0]);
      set_file_name(file.name);
      set_headers(hdrs);
      set_rows(json);
      const auto = detect_mapping(hdrs);
      set_mapping({ ...EMPTY_MAPPING, ...auto });
      set_step(2);
    } catch (e: any) {
      toast.error(ti("toast.read_error", { msg: e?.message || ti("unknown") }));
    }
  }, []);

  const on_drop = (e: React.DragEvent) => {
    e.preventDefault();
    set_drag_active(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handle_file(f);
  };

  const download_template = () => {
    const chiavi = TARGET_FIELDS.map((f) => f.key);
    const ws = XLSX.utils.aoa_to_sheet([
      chiavi.map((k) => TEMPLATE_HEADERS[k]),
      chiavi.map((k) => TEMPLATE_ESEMPIO[k]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atleti");
    XLSX.writeFile(wb, "template-atleti.xlsx");
  };

  // ── STEP 2: validazione mapping ──
  const categoria_decisa = !!mapping.categoria || !!categoria_generale;
  const mapping_valido = useMemo(() => {
    return TARGET_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]) && categoria_decisa;
  }, [mapping, categoria_decisa]);

  // ── STEP 3: build parsed ──
  const build_parsed = useCallback(() => {
    const out: ParsedRow[] = [];
    // Specchio dei doppioni interni al file: la prima riga vale, le altre no.
    const viste = new Map<string, number>();

    rows.forEach((r, idx) => {
      const get = (k: TargetKey) => (mapping[k] ? norm_string(r[mapping[k]]) : "");
      const nome = get("nome");
      const cognome = get("cognome");
      const data_raw = mapping.data_nascita ? r[mapping.data_nascita] : "";
      const data_nascita = parse_date(data_raw) || "";
      const sesso_raw = normalize_sesso(mapping.sesso ? r[mapping.sesso] : "");
      const email = get("email").toLowerCase();
      const livello_input = get("livello");
      const categoria_input = get("categoria");

      // Normalizzazione livello: matching permissivo contro elenco ufficiale.
      // Se non riconosciuto → warning (non errore), livello salvato come "".
      let livello_canonico = "";
      let livello_warning = false;
      if (livello_input) {
        const matched = match_livello_canonico(livello_input, livelli_db);
        if (matched) livello_canonico = matched;
        else livello_warning = true;
      }

      // Categoria: la colonna del file vince sulla scelta valida per tutto l'elenco.
      const cat_file = categoria_input ? match_categoria(categoria_input) : null;
      const categoria_warning = !!categoria_input && !cat_file;
      const categoria_finale = cat_file ?? categoria_generale;

      const errors: string[] = [];
      if (!nome) errors.push(ti("err.nome"));
      if (!cognome) errors.push(ti("err.cognome"));
      if (mapping.data_nascita && !data_nascita) errors.push(ti("err.data_invalid"));
      else if (!data_nascita) errors.push(ti("err.data_missing"));
      if (sesso_raw && !["M", "F"].includes(sesso_raw)) errors.push(ti("err.sesso"));
      if (email && !valid_email(email)) errors.push(ti("err.email"));
      if (!categoria_finale) errors.push(ti("err.categoria"));

      // Doppione dentro lo stesso file
      const chiave = (nome && cognome && data_nascita) ? dup_key(nome, cognome, data_nascita) : "";
      if (chiave) {
        const prima = viste.get(chiave);
        if (prima !== undefined) errors.push(ti("err.doppione_file", { riga: prima }));
        else viste.set(chiave, idx + 2);
      }

      const existing = chiave ? atleti_index.get(chiave) : undefined;

      let status: ParsedRow["status"] = "nuovo";
      if (errors.length > 0) status = "errore";
      else if (existing) status = "aggiornamento";

      const email_mancante = status === "nuovo" && !email;

      out.push({
        idx,
        raw: r,
        normalized: {
          nome, cognome, data_nascita, sesso: sesso_raw, email,
          telefono: get("telefono"),
          livello: livello_canonico,
          categoria: categoria_finale,
          genitore1_telefono: get("genitore1_telefono"),
          genitore1_nome: get("genitore1_nome"),
          genitore1_cognome: get("genitore1_cognome"),
          genitore1_indirizzo: get("genitore1_indirizzo"),
          genitore1_cap: get("genitore1_cap"),
          genitore1_citta: get("genitore1_citta"),
          genitore1_cantone: get("genitore1_cantone"),
        },
        categoria_finale,
        livello_raw: livello_input || undefined,
        livello_warning,
        categoria_warning,
        email_mancante,
        errors,
        status,
        existing_id: existing?.id,
      });
    });
    set_parsed(out);
    set_step(3);
  }, [rows, mapping, livelli_db, atleti_index, categoria_generale]);

  // Se l'elenco atleti (o dei livelli) arriva dopo la classificazione, la rifacciamo:
  // altrimenti resterebbe in giro uno snapshot costruito su un elenco vuoto.
  useEffect(() => {
    if (step === 3 && parsed.length > 0 && atleti_pronti) build_parsed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atleti_index, livelli_db.length]);

  const counts = useMemo(() => ({
    nuovi: parsed.filter((p) => p.status === "nuovo").length,
    aggiornamenti: parsed.filter((p) => p.status === "aggiornamento").length,
    errori: parsed.filter((p) => p.status === "errore").length,
    warning_livello: parsed.filter((p) => p.livello_warning).length,
    senza_email: parsed.filter((p) => p.email_mancante).length,
  }), [parsed]);

  // Anteprima ridotta sui file grossi: prime 100 righe + tutte quelle con errori o warning.
  const file_grosso = parsed.length > SOGLIA_RIGHE;
  const righe_visibili = useMemo(() => {
    if (!file_grosso) return parsed;
    return parsed.filter((p, i) =>
      i < RIGHE_ANTEPRIMA || p.errors.length > 0 || p.livello_warning || p.email_mancante || p.categoria_warning
    );
  }, [parsed, file_grosso]);

  /** Valori da scrivere su `atleti` per una riga, colonna per colonna. */
  const valori_riga = (row: ParsedRow): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const f of TARGET_FIELDS) {
      if (f.key === "categoria") continue;
      const v = row.normalized[f.key];
      if (v) out[f.colonna] = v;
    }
    out.categoria = row.categoria_finale;
    return out;
  };

  // ── STEP 4: import ──
  const run_import = async () => {
    if (!atleti_pronti) {
      toast.error(ti("blocco_atleti"));
      return;
    }
    const da_fare = parsed.filter((p) => p.status !== "errore");
    set_importing(true);
    set_step(4);
    set_report(null);
    set_progresso({ fatte: 0, totale: da_fare.length });

    let creati = 0;
    let aggiornati = 0;
    const falliti: RigaFallita[] = parsed
      .filter((p) => p.status === "errore")
      .map((p) => ({ riga: p.idx + 2, nome: `${p.normalized.nome} ${p.normalized.cognome}`.trim(), motivo: p.errors.join("; ") }));

    for (const row of da_fare) {
      try {
        const valori = valori_riga(row);
        if (row.status === "aggiornamento" && row.existing_id) {
          const existing = atleti_db.find((a: any) => a.id === row.existing_id);
          const patch: Record<string, any> = {};
          // Si riempiono solo i campi vuoti: l'Excel non sovrascrive quello che c'è già.
          for (const [col, val] of Object.entries(valori)) {
            if (col === "nome" || col === "cognome" || col === "data_nascita" || col === "categoria") continue;
            if (!(existing as any)?.[col] && val) patch[col] = val;
          }
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase.from("atleti").update(patch).eq("id", row.existing_id);
            if (error) throw error;
          }
          aggiornati++;
        } else {
          // Nessuna chiamata a genera_codice_atleta: il codice lo assegna il database
          // (trigger trg_atleti_set_codice_atleta) quando arriva vuoto.
          const insert_payload: Record<string, any> = {
            ...valori,
            club_id,
            agonista: false,
            importato_da_excel: true,
            verificato: false,
          };
          const { error } = await supabase.from("atleti").insert(insert_payload);
          if (error) throw error;
          creati++;
        }
      } catch (e: any) {
        falliti.push({
          riga: row.idx + 2,
          nome: `${row.normalized.nome} ${row.normalized.cognome}`.trim(),
          motivo: e?.message || ti("unknown"),
        });
        void segnala_errore("ImportAtletiPage", ti("toast.row_error", { riga: row.idx + 2, msg: e?.message || ti("unknown") }), e, undefined, "avviso");
      } finally {
        set_progresso((p) => ({ ...p, fatte: p.fatte + 1 }));
      }
    }

    set_report({ creati, aggiornati, errori: falliti.length, falliti });
    set_importing(false);

    // Lo specchio locale è vecchio: senza rilettura un secondo giro ricreerebbe tutto.
    await query_client.invalidateQueries({ queryKey: ["atleti"] });
    await query_client.invalidateQueries({ queryKey: ["atleti_import_match", club_id] });
  };

  const scarica_falliti = () => {
    if (!report || report.falliti.length === 0) return;
    const righe = [
      [ti("scarica.col_riga"), ti("scarica.col_atleta"), ti("scarica.col_motivo")],
      ...report.falliti.map((f) => [String(f.riga), f.nome, f.motivo]),
    ];
    const csv = righe.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "righe-non-importate.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const ricomincia = async () => {
    // Prima si rilegge lo specchio, poi si riparte: altrimenti gli atleti appena
    // creati risulterebbero di nuovo nuovi.
    await ricarica_atleti();
    set_step(1);
    set_file_name(""); set_headers([]); set_rows([]); set_parsed([]); set_report(null);
    set_mapping(EMPTY_MAPPING);
    set_categoria_generale("");
    set_progresso({ fatte: 0, totale: 0 });
  };

  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> {t("import.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("import.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/atleti")} disabled={importing}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("import.back_athletes")}
        </Button>
      </div>

      <StepIndicator step={step} />

      {lettura_fallita && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-destructive">{t("import.blocco_atleti")}</p>
          <Button variant="outline" size="sm" onClick={() => ricarica_atleti()}>
            {t("import.riprova")}
          </Button>
        </div>
      )}

      {!lettura_fallita && !atleti_pronti && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("import.attesa_atleti")}</p>
        </div>
      )}

      {livelli_errore && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm text-amber-800">{t("import.avviso_livelli")}</p>
          <Button variant="outline" size="sm" onClick={() => ricarica_livelli()}>
            {t("import.riprova")}
          </Button>
        </div>
      )}


      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); set_drag_active(true); }}
            onDragLeave={() => set_drag_active(false)}
            onDrop={on_drop}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              drag_active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => file_input_ref.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">{t("import.dropzone")}</p>
            <p className="text-xs text-muted-foreground">{t("import.formats")}</p>
            <input
              ref={file_input_ref}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handle_file(f); }}
            />
          </div>
          <div className="flex justify-center">
            <Button variant="outline" onClick={download_template}>
              <Download className="w-4 h-4 mr-2" /> {t("import.download_template")}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <p className="text-sm"><strong>{t("import.file")}</strong> {file_name} — {t("import.rows_found", { count: rows.length })}</p>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-sm font-semibold">{t("import.categoria_domanda")}</p>
            <p className="text-xs text-muted-foreground">{t("import.categoria_nota")}</p>
            <Select value={categoria_generale || "__none__"} onValueChange={(v) => set_categoria_generale(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={t("import.categoria_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("import.categoria_placeholder")}</SelectItem>
                {CATEGORIE.map((c) => (
                  <SelectItem key={c} value={c}>{get_categoria_label(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">{t("import.target_field")}</th>
                  <th className="px-4 py-2 text-left">{t("import.file_column")}</th>
                </tr>
              </thead>
              <tbody>
                {TARGET_FIELDS.map((f) => (
                  <tr key={f.key} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">
                      {ti(f.label_key)} {f.required && <span className="text-destructive">*</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={mapping[f.key] || "__none__"}
                        onValueChange={(v) => set_mapping((m) => ({ ...m, [f.key]: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger className="w-full max-w-md">
                          <SelectValue placeholder={t("import.not_mapped")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("import.not_mapped")}</SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => set_step(1)}><ArrowLeft className="w-4 h-4 mr-2" /> {t("import.back")}</Button>
            <Button disabled={!mapping_valido || !atleti_pronti} onClick={build_parsed}>
              {t("import.continue")} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          {!mapping_valido && (
            <p className="text-xs text-destructive">
              {categoria_decisa ? t("import.required_hint") : t("import.categoria_hint")}
            </p>
          )}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">🟢 {t("import.count_new", { count: counts.nuovi })}</Badge>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">🟡 {t("import.count_updates", { count: counts.aggiornamenti })}</Badge>
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">🔴 {t("import.count_errors", { count: counts.errori })}</Badge>
            {counts.warning_livello > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">⚠️ {t("import.count_warn_livello", { count: counts.warning_livello })}</Badge>
            )}
            {counts.senza_email > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">⚠️ {t("import.count_senza_email", { count: counts.senza_email })}</Badge>
            )}
            <span className="text-xs text-muted-foreground ml-2">{t("import.total_rows", { count: parsed.length })}</span>
          </div>

          {file_grosso && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                {t("import.file_grosso", { totale: parsed.length, mostrate: righe_visibili.length })}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">{t("import.col.stato")}</th>
                  <th className="px-2 py-2 text-left">{t("import.field.nome")}</th>
                  <th className="px-2 py-2 text-left">{t("import.field.cognome")}</th>
                  <th className="px-2 py-2 text-left">{t("import.col.data_nasc")}</th>
                  <th className="px-2 py-2 text-left">{t("import.col.sesso")}</th>
                  <th className="px-2 py-2 text-left">{t("import.field.email_genitore")}</th>
                  <th className="px-2 py-2 text-left">{t("import.field.telefono_atleta")}</th>
                  <th className="px-2 py-2 text-left">{t("import.field.livello")}</th>
                  <th className="px-2 py-2 text-left">{t("import.field.categoria")}</th>
                  <th className="px-2 py-2 text-left">{t("import.col.note")}</th>
                </tr>
              </thead>
              <tbody>
                {righe_visibili.map((p) => (
                  <tr key={p.idx} className={`border-t border-border ${(p.livello_warning || p.email_mancante) && p.status !== "errore" ? "bg-yellow-50/60 dark:bg-yellow-950/10" : ""}`}>
                    <td className="px-2 py-1.5">{p.idx + 2}</td>
                    <td className="px-2 py-1.5">
                      {p.status === "nuovo" && <span title={t("import.status.nuovo")}>🟢</span>}
                      {p.status === "aggiornamento" && <span title={t("import.status.aggiornamento")}>🟡</span>}
                      {p.status === "errore" && <span title={t("import.status.errore")}>🔴</span>}
                    </td>
                    <td className="px-2 py-1.5">{p.normalized.nome}</td>
                    <td className="px-2 py-1.5">{p.normalized.cognome}</td>
                    <td className="px-2 py-1.5">{p.normalized.data_nascita}</td>
                    <td className="px-2 py-1.5">{p.normalized.sesso}</td>
                    <td className="px-2 py-1.5">{p.normalized.email}</td>
                    <td className="px-2 py-1.5">{p.normalized.telefono}</td>
                    <td className="px-2 py-1.5">
                      {p.livello_warning ? (
                        <span className="inline-flex items-center gap-1 text-yellow-700 dark:text-yellow-400" title={t("import.livello_warn_tooltip", { livello: p.livello_raw })}>
                          <span>⚠️</span>
                          <span className="line-through opacity-70">{p.livello_raw}</span>
                          <span className="text-muted-foreground">→ —</span>
                        </span>
                      ) : (
                        p.normalized.livello
                      )}
                    </td>
                    <td className="px-2 py-1.5">{get_categoria_label(p.categoria_finale)}</td>
                    <td className="px-2 py-1.5 space-y-0.5">
                      {p.errors.length > 0 && <div className="text-destructive">{p.errors.join("; ")}</div>}
                      {p.errors.length === 0 && p.livello_warning && (
                        <div className="text-yellow-700 dark:text-yellow-400">{t("import.livello_warn", { livello: p.livello_raw })}</div>
                      )}
                      {p.errors.length === 0 && p.email_mancante && (
                        <div className="text-yellow-700 dark:text-yellow-400">{t("import.warn_senza_email")}</div>
                      )}
                      {p.errors.length === 0 && p.categoria_warning && (
                        <div className="text-yellow-700 dark:text-yellow-400">{t("import.warn_categoria", { categoria: get_categoria_label(p.categoria_finale) })}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => set_step(2)} disabled={importing}>
              <ArrowLeft className="w-4 h-4 mr-2" /> {t("import.back")}
            </Button>
            <Button onClick={run_import} disabled={importing || !atleti_pronti || (counts.nuovi + counts.aggiornamenti) === 0}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {t("import.do_import", { count: counts.nuovi + counts.aggiornamenti })}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="space-y-4">
          {importing && (
            <div className="p-6 rounded-lg border border-border bg-muted/30 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-medium">{t("import.in_progress")}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progresso.totale ? Math.round((progresso.fatte / progresso.totale) * 100) : 0}%` }}
                />
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                {t("import.avanzamento", { fatte: progresso.fatte, totale: progresso.totale })}
              </p>
            </div>
          )}
          {report && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-6 bg-emerald-50 dark:bg-emerald-950/20">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5" /> {t("import.completed")}
                </h2>
                <ul className="space-y-1 text-sm">
                  <li>✅ <strong>{report.creati}</strong> {t("import.report_created")}</li>
                  <li>🟡 <strong>{report.aggiornati}</strong> {t("import.report_updated")}</li>
                  {report.errori > 0 && (
                    <li className="text-destructive">🔴 <strong>{report.errori}</strong> {t("import.report_errors")}</li>
                  )}
                </ul>
              </div>

              {report.falliti.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-destructive">{t("import.falliti_titolo", { count: report.falliti.length })}</p>
                    <Button variant="outline" size="sm" onClick={scarica_falliti}>
                      <Download className="w-4 h-4 mr-2" /> {t("import.scarica_falliti")}
                    </Button>
                  </div>
                  <div className="rounded-md border border-border bg-background overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left">{t("import.scarica.col_riga")}</th>
                          <th className="px-2 py-2 text-left">{t("import.scarica.col_atleta")}</th>
                          <th className="px-2 py-2 text-left">{t("import.scarica.col_motivo")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.falliti.map((f) => (
                          <tr key={`${f.riga}-${f.motivo}`} className="border-t border-border">
                            <td className="px-2 py-1.5 tabular-nums">{f.riga}</td>
                            <td className="px-2 py-1.5">{f.nome}</td>
                            <td className="px-2 py-1.5">{f.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3">
                <h3 className="text-sm font-bold text-foreground">{t("import.prossimo_passo_titolo")}</h3>
                <p className="text-sm text-muted-foreground">{t("import.prossimo_passo_testo")}</p>
                <Button onClick={() => navigate("/richieste-iscrizione")}>
                  <UserPlus className="w-4 h-4 mr-2" /> {t("import.prossimo_passo_bottone")}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/atleti")}>
                  <Home className="w-4 h-4 mr-2" /> {t("import.back_athletes")}
                </Button>
                <Button variant="outline" onClick={ricomincia}>
                  {t("import.another_file")}
                </Button>
              </div>
            </div>
          )}
          {!importing && !report && (
            <div className="flex items-center gap-3 p-6 rounded-lg border border-border bg-muted/30">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">{t("import.no_report")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportAtletiPage;
