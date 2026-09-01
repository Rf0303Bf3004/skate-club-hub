import React, { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  detect_mapping,
  leggi_foglio,
  norm_string,
  parse_date,
  valid_email,
} from "@/lib/xlsx-import";
import type { EsitoImportOspite, RigaOspiteInput } from "@/hooks/use-campi-interclub";

const CAMPI = [
  "nome",
  "cognome",
  "data_nascita",
  "livello",
  "dal",
  "al",
  "email",
  "telefono",
  "emergenza",
  "note",
  "consenso_foto",
  "consenso_ricontatto",
] as const;
type Campo = (typeof CAMPI)[number];

const SINONIMI: Record<Campo, string[]> = {
  nome: ["nome", "name", "first name", "firstname"],
  cognome: ["cognome", "surname", "last name", "lastname", "family name"],
  data_nascita: ["data di nascita", "data nascita", "datanascita", "birthday", "birthdate", "date of birth", "dob", "nato il"],
  livello: ["livello", "level", "categoria", "livello dichiarato"],
  dal: ["dal", "da", "inizio", "data inizio", "from", "start"],
  al: ["al", "a", "fine", "data fine", "to", "end"],
  email: ["email", "e-mail", "mail", "posta"],
  telefono: ["telefono", "tel", "cell", "cellulare", "phone", "mobile"],
  emergenza: ["contatto emergenza", "contatto di emergenza", "emergenza", "emergency", "emergency contact"],
  note: ["note", "notes", "osservazioni"],
  consenso_foto: ["consenso foto", "foto", "consenso immagini", "photo consent"],
  consenso_ricontatto: ["consenso ricontatto", "ricontatto", "marketing", "contact consent"],
};

const parse_bool = (v: any): boolean | null => {
  const s = norm_string(v).toLowerCase();
  if (!s) return null;
  if (["si", "sì", "yes", "y", "true", "1", "x", "ok"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return null;
};

type RigaPreview = RigaOspiteInput & { idx: number; errori: string[] };

const riga_vuota = (): RigaOspiteInput => ({
  nome: "",
  cognome: "",
  data_nascita: null,
  livello: null,
  dal: null,
  al: null,
  email: null,
  telefono: null,
  emergenza: null,
  note: null,
  consenso_foto: null,
  consenso_ricontatto: null,
});

type Props = {
  /** Esegue la registrazione e ritorna l'esito riga per riga. */
  on_submit: (elenco: RigaOspiteInput[]) => Promise<EsitoImportOspite[]>;
  /** Mostra anche la compilazione manuale dell'elenco. */
  consenti_manuale?: boolean;
};

const OspitiImportWizard: React.FC<Props> = ({ on_submit, consenti_manuale = false }) => {
  const { t } = useTranslation("events");
  const tk = (k: string, o?: any) => t(`campi_interclub.ospiti.${k}`, o) as string;

  const [modo, set_modo] = useState<"excel" | "manuale">("excel");
  const [headers, set_headers] = useState<string[]>([]);
  const [rows, set_rows] = useState<Record<string, any>[]>([]);
  const [file_name, set_file_name] = useState("");
  const [mapping, set_mapping] = useState<Partial<Record<Campo, string>>>({});
  const [manuali, set_manuali] = useState<RigaOspiteInput[]>([riga_vuota()]);
  const [invio, set_invio] = useState(false);
  const [esiti, set_esiti] = useState<EsitoImportOspite[] | null>(null);

  const carica_file = useCallback(async (file: File) => {
    try {
      const { headers: h, rows: r } = await leggi_foglio(file);
      if (r.length === 0) {
        toast.error(tk("nessuna_riga"));
        return;
      }
      set_file_name(file.name);
      set_headers(h);
      set_rows(r);
      set_mapping(detect_mapping<Campo>(h, SINONIMI));
      set_esiti(null);
    } catch (e: any) {
      toast.error(e?.message ?? tk("errore_lettura"));
    }
  }, []);

  const scarica_modello = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome", "Cognome", "Data di nascita", "Livello", "dal", "al", "email", "telefono", "contatto emergenza", "consenso foto", "consenso ricontatto"],
      ["Mario", "Rossi", "12.05.2010", "Stellina 2", "01.07.2026", "10.07.2026", "mario@example.com", "+41791234567", "Anna Rossi +41790000000", "si", "no"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ospiti");
    XLSX.writeFile(wb, "modello-atleti-ospiti.xlsx");
  };

  const anteprima: RigaPreview[] = useMemo(() => {
    const sorgente: RigaOspiteInput[] =
      modo === "manuale"
        ? manuali
        : rows.map((r) => {
            const g = (k: Campo) => (mapping[k] ? norm_string(r[mapping[k] as string]) : "");
            return {
              nome: g("nome"),
              cognome: g("cognome"),
              data_nascita: parse_date(mapping.data_nascita ? r[mapping.data_nascita] : ""),
              livello: g("livello") || null,
              dal: parse_date(mapping.dal ? r[mapping.dal] : ""),
              al: parse_date(mapping.al ? r[mapping.al] : ""),
              email: g("email").toLowerCase() || null,
              telefono: g("telefono") || null,
              emergenza: g("emergenza") || null,
              note: g("note") || null,
              consenso_foto: parse_bool(mapping.consenso_foto ? r[mapping.consenso_foto] : ""),
              consenso_ricontatto: parse_bool(mapping.consenso_ricontatto ? r[mapping.consenso_ricontatto] : ""),
            };
          });
    return sorgente.map((v, idx) => {
      const errori: string[] = [];
      if (!v.nome) errori.push(tk("err_nome"));
      if (!v.cognome) errori.push(tk("err_cognome"));
      if (!v.data_nascita) errori.push(tk("err_data"));
      if (v.email && !valid_email(v.email)) errori.push(tk("err_email"));
      return { ...v, idx, errori };
    });
  }, [modo, manuali, rows, mapping]);

  const valide = anteprima.filter((r) => r.errori.length === 0);

  const conferma = async () => {
    if (valide.length === 0) {
      toast.error(tk("nessuna_riga_valida"));
      return;
    }
    set_invio(true);
    try {
      const res = await on_submit(valide.map(({ idx, errori, ...v }) => v));
      set_esiti(res);
      toast.success(tk("import_completato", { count: res.filter((e) => !String(e.esito ?? "").startsWith("SCARTATO")).length }));
    } catch (e: any) {
      toast.error(e?.message ?? tk("errore_import"));
    } finally {
      set_invio(false);
    }
  };

  const upd_manuale = (i: number, patch: Partial<RigaOspiteInput>) =>
    set_manuali((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  if (esiti) {
    return (
      <div className="space-y-3">
        <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
          {esiti.map((e, i) => {
            const scartato = String(e.esito ?? "").startsWith("SCARTATO");
            return (
              <div key={i} className="flex items-center justify-between gap-3 p-2 text-sm">
                <span>
                  {e.riga}. {e.cognome} {e.nome}
                </span>
                <span className="flex items-center gap-2">
                  {e.codice_atleta && <code className="text-xs font-mono">{e.codice_atleta}</code>}
                  <Badge variant={scartato ? "destructive" : "secondary"}>{e.esito}</Badge>
                </span>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            set_esiti(null);
            set_rows([]);
            set_headers([]);
            set_file_name("");
            set_manuali([riga_vuota()]);
          }}
        >
          {tk("nuovo_import")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consenti_manuale && (
        <div className="flex gap-2">
          <Button size="sm" variant={modo === "excel" ? "default" : "outline"} onClick={() => set_modo("excel")}>
            {tk("modo_excel")}
          </Button>
          <Button size="sm" variant={modo === "manuale" ? "default" : "outline"} onClick={() => set_modo("manuale")}>
            {tk("modo_manuale")}
          </Button>
        </div>
      )}

      {modo === "excel" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) carica_file(f);
                }}
              />
              <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                <Upload className="w-4 h-4" /> {tk("scegli_file")}
              </span>
            </label>
            <Button size="sm" variant="ghost" onClick={scarica_modello}>
              <Download className="w-4 h-4 mr-1" /> {tk("modello")}
            </Button>
            {file_name && <span className="text-sm text-muted-foreground">{file_name}</span>}
          </div>

          {headers.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {CAMPI.map((c) => (
                <div key={c}>
                  <Label className="text-xs">{tk(`campo_${c}`)}</Label>
                  <Select
                    value={mapping[c] ?? "__nessuna__"}
                    onValueChange={(v) => set_mapping({ ...mapping, [c]: v === "__nessuna__" ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nessuna__">{tk("colonna_nessuna")}</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {manuali.map((r, i) => (
            <div key={i} className="grid sm:grid-cols-6 gap-2 items-end border rounded-lg p-2">
              <div className="sm:col-span-1">
                <Label className="text-xs">{tk("campo_nome")}</Label>
                <Input value={r.nome} onChange={(e) => upd_manuale(i, { nome: e.target.value })} />
              </div>
              <div className="sm:col-span-1">
                <Label className="text-xs">{tk("campo_cognome")}</Label>
                <Input value={r.cognome} onChange={(e) => upd_manuale(i, { cognome: e.target.value })} />
              </div>
              <div className="sm:col-span-1">
                <Label className="text-xs">{tk("campo_data_nascita")}</Label>
                <Input type="date" value={r.data_nascita ?? ""} onChange={(e) => upd_manuale(i, { data_nascita: e.target.value || null })} />
              </div>
              <div className="sm:col-span-1">
                <Label className="text-xs">{tk("campo_livello")}</Label>
                <Input value={r.livello ?? ""} onChange={(e) => upd_manuale(i, { livello: e.target.value || null })} />
              </div>
              <div className="sm:col-span-1">
                <Label className="text-xs">{tk("campo_dal")}</Label>
                <Input type="date" value={r.dal ?? ""} onChange={(e) => upd_manuale(i, { dal: e.target.value || null })} />
              </div>
              <div className="flex items-center gap-2 sm:col-span-1">
                <div className="flex-1">
                  <Label className="text-xs">{tk("campo_al")}</Label>
                  <Input type="date" value={r.al ?? ""} onChange={(e) => upd_manuale(i, { al: e.target.value || null })} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => set_manuali((prev) => (prev.length === 1 ? [riga_vuota()] : prev.filter((_, k) => k !== i)))}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => set_manuali([...manuali, riga_vuota()])}>
            <Plus className="w-4 h-4 mr-1" /> {tk("aggiungi_riga")}
          </Button>
        </div>
      )}

      {anteprima.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {tk("riepilogo", { valide: valide.length, totale: anteprima.length })}
          </p>
          <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
            {anteprima.map((r) => (
              <div key={r.idx} className="flex items-center justify-between gap-3 p-2 text-sm">
                <span>
                  {r.cognome} {r.nome} {r.data_nascita ? `• ${r.data_nascita}` : ""} {r.livello ? `• ${r.livello}` : ""}
                </span>
                {r.errori.length > 0 ? (
                  <Badge variant="destructive">{r.errori.join(", ")}</Badge>
                ) : (
                  <Badge variant="secondary">{tk("ok")}</Badge>
                )}
              </div>
            ))}
          </div>
          <Button onClick={conferma} disabled={invio || valide.length === 0}>
            {invio && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tk("conferma", { count: valide.length })}
          </Button>
        </div>
      )}
    </div>
  );
};

export default OspitiImportWizard;
