import React, { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase, get_current_club_id } from "@/lib/supabase";
import {
  Upload, FileSpreadsheet, Download, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, Home,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// Tipi & costanti
// ──────────────────────────────────────────────────────────────────

const TARGET_FIELDS = [
  { key: "nome",          label: "Nome",          required: true  },
  { key: "cognome",       label: "Cognome",       required: true  },
  { key: "data_nascita",  label: "Data di nascita", required: true },
  { key: "sesso",         label: "Sesso (M/F)",     required: false },
  { key: "email",         label: "Email",         required: false },
  { key: "telefono",      label: "Telefono",      required: false },
  { key: "livello",       label: "Livello",       required: false },
] as const;

type TargetKey = typeof TARGET_FIELDS[number]["key"];

const SYNONYMS: Record<TargetKey, string[]> = {
  nome:         ["nome", "name", "first name", "firstname"],
  cognome:      ["cognome", "surname", "last name", "lastname", "family name"],
  data_nascita: ["data nascita", "data di nascita", "datanascita", "birthday", "birthdate", "date of birth", "dob", "nato il"],
  sesso:        ["sesso", "genere", "gender", "sex"],
  email:        ["email", "e-mail", "mail", "posta", "indirizzo email"],
  telefono:     ["telefono", "tel", "cell", "cellulare", "phone", "mobile", "numero"],
  livello:      ["livello", "level", "categoria", "livello attuale"],
};

type RowRecord = Record<string, any>;
type ParsedRow = {
  idx: number;
  raw: RowRecord;
  normalized: Record<TargetKey, string>;
  errors: string[];
  status: "nuovo" | "aggiornamento" | "errore";
  existing_id?: string;
};

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function strip_accents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalize_header(s: string): string {
  return strip_accents(String(s || "").trim().toLowerCase()).replace(/[\s._-]+/g, " ");
}

function detect_mapping(headers: string[]): Record<TargetKey, string> {
  const out: Partial<Record<TargetKey, string>> = {};
  for (const t of TARGET_FIELDS) {
    const syns = SYNONYMS[t.key].map(normalize_header);
    const found = headers.find((h) => syns.includes(normalize_header(h)));
    if (found) out[t.key] = found;
  }
  return out as Record<TargetKey, string>;
}

function parse_date(value: any): string | null {
  if (value == null || value === "") return null;
  // Excel serial number
  if (typeof value === "number" && isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) {
      const yyyy = String(d.y).padStart(4, "0");
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const s = String(value).trim();
  // ISO
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let yy = m[3];
    if (yy.length === 2) yy = (parseInt(yy) > 30 ? "19" : "20") + yy;
    return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function dup_key(nome: string, cognome: string, data_nascita: string): string {
  return `${nome.toLowerCase()}|${cognome.toLowerCase()}|${data_nascita}`;
}

// ──────────────────────────────────────────────────────────────────
// Step components
// ──────────────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ step: number }> = ({ step }) => {
  const steps = ["Upload file", "Mapping colonne", "Anteprima", "Importa"];
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
  const navigate = useNavigate();
  const club_id = get_current_club_id();

  const [step, set_step] = useState<1 | 2 | 3 | 4>(1);
  const [file_name, set_file_name] = useState<string>("");
  const [headers, set_headers] = useState<string[]>([]);
  const [rows, set_rows] = useState<RowRecord[]>([]);
  const [mapping, set_mapping] = useState<Record<TargetKey, string>>(
    Object.fromEntries(TARGET_FIELDS.map((t) => [t.key, ""])) as any
  );
  const [parsed, set_parsed] = useState<ParsedRow[]>([]);
  const [importing, set_importing] = useState(false);
  const [report, set_report] = useState<{ creati: number; aggiornati: number; errori: number; codici: string[] } | null>(null);
  const [drag_active, set_drag_active] = useState(false);
  const file_input_ref = useRef<HTMLInputElement>(null);

  // Fetch livelli per validazione
  const { data: livelli_db = [] } = useQuery({
    queryKey: ["livelli_import"],
    queryFn: async () => {
      const { data } = await supabase.from("livelli").select("nome").eq("attivo", true);
      return (data ?? []).map((l: any) => norm_string(l.nome));
    },
  });
  const livelli_set = useMemo(() => new Set(livelli_db.map((l) => l.toLowerCase())), [livelli_db]);

  // Fetch atleti del club per match duplicati
  const { data: atleti_db = [] } = useQuery({
    queryKey: ["atleti_import_match", club_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atleti")
        .select("id, nome, cognome, data_nascita, telefono, genitore1_email, livello_attuale")
        .eq("club_id", club_id);
      return data ?? [];
    },
  });
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
        toast.error("Il file non contiene righe");
        return;
      }
      const hdrs = Object.keys(json[0]);
      set_file_name(file.name);
      set_headers(hdrs);
      set_rows(json);
      const auto = detect_mapping(hdrs);
      set_mapping({
        nome: auto.nome ?? "",
        cognome: auto.cognome ?? "",
        data_nascita: auto.data_nascita ?? "",
        sesso: auto.sesso ?? "",
        email: auto.email ?? "",
        telefono: auto.telefono ?? "",
        livello: auto.livello ?? "",
      });
      set_step(2);
    } catch (e: any) {
      toast.error("Errore lettura file: " + (e?.message || "sconosciuto"));
    }
  }, []);

  const on_drop = (e: React.DragEvent) => {
    e.preventDefault();
    set_drag_active(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handle_file(f);
  };

  const download_template = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nome", "cognome", "data_nascita", "sesso", "email", "telefono", "livello"],
      ["Mario", "Rossi", "2010-05-12", "M", "mario@example.com", "+41791234567", "Stellina 2"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atleti");
    XLSX.writeFile(wb, "template-atleti.xlsx");
  };

  // ── STEP 2: validazione mapping ──
  const mapping_valido = useMemo(() => {
    return TARGET_FIELDS.filter((t) => t.required).every((t) => mapping[t.key]);
  }, [mapping]);

  // ── STEP 3: build parsed ──
  const build_parsed = useCallback(() => {
    const out: ParsedRow[] = [];
    rows.forEach((r, idx) => {
      const get = (k: TargetKey) => (mapping[k] ? norm_string(r[mapping[k]]) : "");
      const nome = get("nome");
      const cognome = get("cognome");
      const data_raw = mapping.data_nascita ? r[mapping.data_nascita] : "";
      const data_nascita = parse_date(data_raw) || "";
      const sesso_raw = normalize_sesso(mapping.sesso ? r[mapping.sesso] : "");
      const email = get("email").toLowerCase();
      const telefono = get("telefono");
      const livello = get("livello");

      const errors: string[] = [];
      if (!nome) errors.push("Nome mancante");
      if (!cognome) errors.push("Cognome mancante");
      if (mapping.data_nascita && !data_nascita) errors.push("Data nascita non valida");
      else if (!data_nascita) errors.push("Data nascita mancante");
      if (sesso_raw && !["M", "F"].includes(sesso_raw)) errors.push("Sesso non valido");
      if (email && !valid_email(email)) errors.push("Email malformata");
      if (livello && livelli_set.size > 0 && !livelli_set.has(livello.toLowerCase())) {
        errors.push(`Livello "${livello}" non esistente`);
      }

      const existing = (nome && cognome && data_nascita)
        ? atleti_index.get(dup_key(nome, cognome, data_nascita))
        : undefined;

      let status: ParsedRow["status"] = "nuovo";
      if (errors.length > 0) status = "errore";
      else if (existing) status = "aggiornamento";

      out.push({
        idx,
        raw: r,
        normalized: { nome, cognome, data_nascita, sesso: sesso_raw, email, telefono, livello },
        errors,
        status,
        existing_id: existing?.id,
      });
    });
    set_parsed(out);
    set_step(3);
  }, [rows, mapping, livelli_set, atleti_index]);

  const counts = useMemo(() => ({
    nuovi: parsed.filter((p) => p.status === "nuovo").length,
    aggiornamenti: parsed.filter((p) => p.status === "aggiornamento").length,
    errori: parsed.filter((p) => p.status === "errore").length,
  }), [parsed]);

  // ── STEP 4: import ──
  const run_import = async () => {
    set_importing(true);
    set_step(4);
    let creati = 0;
    let aggiornati = 0;
    let errori = 0;
    const codici: string[] = [];

    for (const row of parsed) {
      if (row.status === "errore") { errori++; continue; }
      try {
        if (row.status === "aggiornamento" && row.existing_id) {
          const existing = atleti_db.find((a: any) => a.id === row.existing_id);
          const patch: Record<string, any> = {};
          if (!existing?.telefono && row.normalized.telefono) patch.telefono = row.normalized.telefono;
          if (!existing?.genitore1_email && row.normalized.email) patch.genitore1_email = row.normalized.email;
          if (!existing?.livello_attuale && row.normalized.livello) patch.livello_attuale = row.normalized.livello;
          if (!existing?.sesso && row.normalized.sesso) patch.sesso = row.normalized.sesso;
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase.from("atleti").update(patch).eq("id", row.existing_id);
            if (error) throw error;
          }
          aggiornati++;
        } else {
          // Genera codice
          const { data: code_data, error: code_err } = await supabase.rpc("genera_codice_atleta" as any);
          if (code_err) throw code_err;
          const codice_atleta = String(code_data);
          const insert_payload: Record<string, any> = {
            club_id,
            nome: row.normalized.nome,
            cognome: row.normalized.cognome,
            data_nascita: row.normalized.data_nascita,
            categoria: "amatori",
            agonista: false,
            codice_atleta,
          };
          if (row.normalized.telefono) insert_payload.telefono = row.normalized.telefono;
          if (row.normalized.email) insert_payload.genitore1_email = row.normalized.email;
          if (row.normalized.livello) insert_payload.livello_attuale = row.normalized.livello;
          const { error } = await supabase.from("atleti").insert(insert_payload);
          if (error) throw error;
          creati++;
          codici.push(codice_atleta);
          toast.success(`Creato ${row.normalized.nome} ${row.normalized.cognome} (${codice_atleta})`);
        }
      } catch (e: any) {
        errori++;
        toast.error(`Errore riga ${row.idx + 2}: ${e?.message || "sconosciuto"}`);
      }
    }

    set_report({ creati, aggiornati, errori, codici });
    set_importing(false);
  };

  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Import atleti da Excel
          </h1>
          <p className="text-sm text-muted-foreground">Importa un elenco di atleti da un file .xlsx o .xls</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/atleti")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Torna ad Atleti
        </Button>
      </div>

      <StepIndicator step={step} />

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
            <p className="text-sm font-medium text-foreground mb-1">Trascina qui il file Excel oppure clicca per selezionarlo</p>
            <p className="text-xs text-muted-foreground">Formati supportati: .xlsx, .xls</p>
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
              <Download className="w-4 h-4 mr-2" /> Scarica template Excel
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <p className="text-sm"><strong>File:</strong> {file_name} — {rows.length} righe trovate</p>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Campo target</th>
                  <th className="px-4 py-2 text-left">Colonna del file</th>
                </tr>
              </thead>
              <tbody>
                {TARGET_FIELDS.map((t) => (
                  <tr key={t.key} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">
                      {t.label} {t.required && <span className="text-destructive">*</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={mapping[t.key] || "__none__"}
                        onValueChange={(v) => set_mapping((m) => ({ ...m, [t.key]: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger className="w-full max-w-md">
                          <SelectValue placeholder="— Non mappare —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Non mappare —</SelectItem>
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
            <Button variant="outline" onClick={() => set_step(1)}><ArrowLeft className="w-4 h-4 mr-2" /> Indietro</Button>
            <Button disabled={!mapping_valido} onClick={build_parsed}>
              Continua <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          {!mapping_valido && (
            <p className="text-xs text-destructive">I campi obbligatori (Nome, Cognome, Data di nascita) devono essere mappati.</p>
          )}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">🟢 {counts.nuovi} nuovi</Badge>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">🟡 {counts.aggiornamenti} aggiornamenti</Badge>
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">🔴 {counts.errori} errori</Badge>
            <span className="text-xs text-muted-foreground ml-2">Totale: {parsed.length} righe</span>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Stato</th>
                  <th className="px-2 py-2 text-left">Nome</th>
                  <th className="px-2 py-2 text-left">Cognome</th>
                  <th className="px-2 py-2 text-left">Data nasc.</th>
                  <th className="px-2 py-2 text-left">Sesso</th>
                  <th className="px-2 py-2 text-left">Email</th>
                  <th className="px-2 py-2 text-left">Telefono</th>
                  <th className="px-2 py-2 text-left">Livello</th>
                  <th className="px-2 py-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p) => (
                  <tr key={p.idx} className="border-t border-border">
                    <td className="px-2 py-1.5">{p.idx + 2}</td>
                    <td className="px-2 py-1.5">
                      {p.status === "nuovo" && <span title="Nuovo">🟢</span>}
                      {p.status === "aggiornamento" && <span title="Aggiornamento">🟡</span>}
                      {p.status === "errore" && <span title="Errore">🔴</span>}
                    </td>
                    <td className="px-2 py-1.5">{p.normalized.nome}</td>
                    <td className="px-2 py-1.5">{p.normalized.cognome}</td>
                    <td className="px-2 py-1.5">{p.normalized.data_nascita}</td>
                    <td className="px-2 py-1.5">{p.normalized.sesso}</td>
                    <td className="px-2 py-1.5">{p.normalized.email}</td>
                    <td className="px-2 py-1.5">{p.normalized.telefono}</td>
                    <td className="px-2 py-1.5">{p.normalized.livello}</td>
                    <td className="px-2 py-1.5 text-destructive">{p.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => set_step(2)} disabled={importing}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
            </Button>
            <Button onClick={run_import} disabled={importing || (counts.nuovi + counts.aggiornamenti) === 0}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Importa {counts.nuovi + counts.aggiornamenti} atleti
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="space-y-4">
          {importing && (
            <div className="flex items-center gap-3 p-6 rounded-lg border border-border bg-muted/30">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Importazione in corso… non chiudere la pagina.</span>
            </div>
          )}
          {report && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-6 bg-emerald-50 dark:bg-emerald-950/20">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5" /> Import completato
                </h2>
                <ul className="space-y-1 text-sm">
                  <li>✅ <strong>{report.creati}</strong> atleti creati</li>
                  <li>🟡 <strong>{report.aggiornati}</strong> atleti aggiornati (solo campi vuoti)</li>
                  {report.errori > 0 && (
                    <li className="text-destructive">🔴 <strong>{report.errori}</strong> errori</li>
                  )}
                </ul>
                {report.codici.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Codici assegnati:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.codici.map((c) => (
                        <code key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">{c}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => navigate("/atleti")}>
                  <Home className="w-4 h-4 mr-2" /> Torna ad Atleti
                </Button>
                <Button variant="outline" onClick={() => {
                  set_step(1); set_file_name(""); set_headers([]); set_rows([]); set_parsed([]); set_report(null);
                }}>
                  Importa un altro file
                </Button>
              </div>
            </div>
          )}
          {!importing && !report && (
            <div className="flex items-center gap-3 p-6 rounded-lg border border-border bg-muted/30">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Nessun report disponibile.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportAtletiPage;
