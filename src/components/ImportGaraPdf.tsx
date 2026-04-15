import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Search, CheckCircle2, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";

const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

interface ElementoAI {
  seq: number;
  nome: string;
  base_value: number;
  goe: number;
  score: number;
  info_flag: string;
}

interface AtletaAI {
  rank: number;
  nome: string;
  club: string;
  starting_number: number;
  tot: number;
  tes: number;
  pcs: number;
  deductions: number;
  pcs_presentation: number;
  pcs_skating_skills: number;
  elementi: ElementoAI[];
}

interface ParsedResult {
  categoria: string;
  gruppo: string;
  disciplina: string;
  atleti: AtletaAI[];
}

interface AtletaDB {
  id: string;
  nome: string;
  cognome: string;
}

interface MatchState {
  atleta_ai: AtletaAI;
  matched_id: string | null; // null = nessun abbinamento (esterno)
  auto_matched: boolean;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function match_atleta(ai_name: string, db_atleti: AtletaDB[]): AtletaDB | null {
  const n = normalize(ai_name);
  return db_atleti.find((a) => {
    const full1 = normalize(`${a.nome} ${a.cognome}`);
    const full2 = normalize(`${a.cognome} ${a.nome}`);
    return n === full1 || n === full2;
  }) ?? null;
}

const ImportGaraPdf: React.FC<{ atleti_db: AtletaDB[]; on_done: () => void }> = ({ atleti_db, on_done }) => {
  const qc = useQueryClient();
  const [file, set_file] = useState<File | null>(null);
  const [nome_gara, set_nome_gara] = useState("");
  const [data_gara, set_data_gara] = useState("");
  const [luogo_gara, set_luogo_gara] = useState("");
  const [segmento, set_segmento] = useState("");
  const [parsing, set_parsing] = useState(false);
  const [parsed, set_parsed] = useState<ParsedResult | null>(null);
  const [matches, set_matches] = useState<MatchState[]>([]);
  const [saving, set_saving] = useState(false);
  const [expanded, set_expanded] = useState(true);
  const [show_elements, set_show_elements] = useState<number | null>(null);

  const handle_file = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      set_file(f);
      set_parsed(null);
      set_matches([]);
    }
  };

  const handle_parse = async () => {
    if (!file) return;
    set_parsing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const pdf_base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke('dynamic-api', {
        body: {
          action: "parse_pdf",
          systemPrompt: 'Extract all skaters from this ISU figure skating PDF and return ONLY valid JSON: {"categoria":"","gruppo":"","disciplina":"","atleti":[{"rank":1,"nome":"FIRSTNAME LASTNAME","club":"ABC","starting_number":3,"tot":14.13,"tes":4.79,"pcs":9.34,"deductions":0,"pcs_presentation":2.25,"pcs_skating_skills":2.42,"elementi":[{"seq":1,"nome":"USpA","base_value":0.60,"goe":0.04,"score":0.64,"info_flag":""}]}]}',
          pdfBase64: pdf_base64,
        },
      });

      if (error) {
        throw new Error(error.message || "Errore nell'analisi del PDF");
      }

      const result: ParsedResult = data;
      set_parsed(result);

      if (result.atleti?.length) {
        if (!nome_gara && result.categoria) set_nome_gara(result.categoria);
      }

      // Auto-match
      const ms: MatchState[] = (result.atleti ?? []).map((a) => {
        const db_match = match_atleta(a.nome, atleti_db);
        return {
          atleta_ai: a,
          matched_id: db_match?.id ?? null,
          auto_matched: !!db_match,
        };
      });
      set_matches(ms);

      toast({ title: `✅ ${ms.length} atleti estratti dal PDF` });
    } catch (err: any) {
      toast({
        title: "Errore analisi PDF",
        description: err?.message ?? "Controlla il file e riprova.",
        variant: "destructive",
      });
    } finally {
      set_parsing(false);
    }
  };

  const update_match = (idx: number, atleta_id: string | null) => {
    set_matches((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, matched_id: atleta_id, auto_matched: false } : m
      )
    );
  };

  const handle_save = async () => {
    if (!parsed || !matches.length) return;
    if (!nome_gara.trim()) {
      toast({ title: "Nome gara obbligatorio", variant: "destructive" });
      return;
    }
    set_saving(true);
    try {
      const club_id = get_current_club_id();

      // 1. Create gara in gare_calendario
      // Check if a gara with the same nome+data already exists for this club
      let gara_id: string;
      const { data: existing_gara } = await supabase
        .from("gare_calendario")
        .select("id")
        .eq("club_id", club_id)
        .eq("nome", nome_gara.trim())
        .eq("data", data_gara || "")
        .maybeSingle();

      if (existing_gara) {
        gara_id = existing_gara.id;
      } else {
        const { data: gara_data, error: gara_err } = await supabase
          .from("gare_calendario")
          .insert({
            club_id,
            nome: nome_gara.trim(),
            data: data_gara || null,
            luogo: luogo_gara.trim() || null,
            note: `Categoria: ${parsed.categoria}, Gruppo: ${parsed.gruppo}, Disciplina: ${parsed.disciplina}`,
          })
          .select("id")
          .single();

        if (gara_err) throw gara_err;
        gara_id = gara_data.id;
      }


      // 2. Insert risultati_gara for each athlete
      let saved_count = 0;
      for (const m of matches) {
        const a = m.atleta_ai;

        const { data: ris_data, error: ris_err } = await supabase
          .from("risultati_gara")
          .insert({
            gara_id,
            atleta_id: m.matched_id || null,
            atleta_nome_esterno: a.nome,
            club_esterno: a.club,
            rank: a.rank,
            starting_number: a.starting_number,
            tot: a.tot,
            tes: a.tes,
            pcs: a.pcs,
            deductions: a.deductions,
            pcs_presentation: a.pcs_presentation,
            pcs_skating_skills: a.pcs_skating_skills,
            categoria: parsed.categoria,
            gruppo: parsed.gruppo,
            disciplina: parsed.disciplina,
          })
          .select("id")
          .single();

        if (ris_err) {
          console.error("Error inserting risultato:", ris_err);
          continue;
        }

        // 3. Insert elementi_gara
        if (a.elementi?.length && ris_data) {
          const elementi_rows = a.elementi.map((el) => ({
            risultato_id: ris_data.id,
            seq: el.seq,
            nome: el.nome,
            base_value: el.base_value,
            goe: el.goe,
            score: el.score,
            info_flag: el.info_flag || "",
          }));

          const { error: el_err } = await supabase
            .from("elementi_gara")
            .insert(elementi_rows);

          if (el_err) console.error("Error inserting elementi:", el_err);
        }

        saved_count++;
      }

      await qc.invalidateQueries({ queryKey: ["gare"] });

      toast({ title: `✅ Gara salvata con ${saved_count} atleti!` });
      set_parsed(null);
      set_matches([]);
      set_file(null);
      set_nome_gara("");
      set_data_gara("");
      set_luogo_gara("");
      on_done();
    } catch (err: any) {
      toast({
        title: "Errore salvataggio",
        description: err?.message ?? "Controlla i dati e riprova.",
        variant: "destructive",
      });
    } finally {
      set_saving(false);
    }
  };

  const matched_count = matches.filter((m) => m.matched_id).length;
  const unmatched_count = matches.filter((m) => !m.matched_id).length;

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
      <CardHeader
        className="cursor-pointer"
        onClick={() => set_expanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Importa risultati da PDF ufficiale ISU</CardTitle>
              <CardDescription>Carica il PDF dei risultati e l'AI estrarrà tutti i dati</CardDescription>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5">
          {/* Upload + fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                File PDF *
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handle_file}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition-colors ${file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {file ? file.name : "Seleziona PDF risultati..."}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nome Gara *
              </label>
              <input
                value={nome_gara}
                onChange={(e) => set_nome_gara(e.target.value)}
                placeholder="es. Trofeo Invernale 2025"
                className={input_cls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data Gara
              </label>
              <input
                type="date"
                value={data_gara}
                onChange={(e) => set_data_gara(e.target.value)}
                className={input_cls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Luogo
              </label>
              <input
                value={luogo_gara}
                onChange={(e) => set_luogo_gara(e.target.value)}
                placeholder="es. Lugano"
                className={input_cls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Segmento
              </label>
              <input
                value={segmento}
                onChange={(e) => set_segmento(e.target.value)}
                placeholder="es. Short Program, Free Skating"
                className={input_cls}
              />
            </div>
          </div>

          <Button
            onClick={handle_parse}
            disabled={!file || parsing}
            className="w-full"
          >
            {parsing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisi in corso… (può richiedere 30-60s)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Analizza PDF
              </span>
            )}
          </Button>

          {/* Preview results */}
          {parsed && matches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">Anteprima risultati</h3>
                {parsed.categoria && (
                  <Badge variant="outline">{parsed.categoria}</Badge>
                )}
                {parsed.gruppo && (
                  <Badge variant="outline">{parsed.gruppo}</Badge>
                )}
                {parsed.disciplina && (
                  <Badge variant="outline">{parsed.disciplina}</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {matched_count} trovati · {unmatched_count} da abbinare
                </span>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Atleta</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Club</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">TOT</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">TES</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">PCS</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Stato</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Abbinamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`border-t border-border hover:bg-muted/30 cursor-pointer ${show_elements === idx ? "bg-muted/20" : ""}`}
                          onClick={() => set_show_elements(show_elements === idx ? null : idx)}
                        >
                          <td className="px-3 py-2 font-mono text-xs">{m.atleta_ai.rank}</td>
                          <td className="px-3 py-2 font-medium">{m.atleta_ai.nome}</td>
                          <td className="px-3 py-2 text-muted-foreground">{m.atleta_ai.club}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{m.atleta_ai.tot.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{m.atleta_ai.tes.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{m.atleta_ai.pcs.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            {m.matched_id ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Trovato in DB
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px]">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Da abbinare
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            {!m.auto_matched || !m.matched_id ? (
                              <select
                                value={m.matched_id || ""}
                                onChange={(e) =>
                                  update_match(idx, e.target.value || null)
                                }
                                className="text-xs rounded border border-border bg-background px-2 py-1 max-w-[180px]"
                              >
                                <option value="">Nessun abbinamento (esterno)</option>
                                {atleti_db.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.cognome} {a.nome}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-green-600">
                                {(() => {
                                  const a = atleti_db.find((x) => x.id === m.matched_id);
                                  return a ? `${a.cognome} ${a.nome}` : "";
                                })()}
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Elementi tecnici espandibili */}
                        {show_elements === idx && m.atleta_ai.elementi?.length > 0 && (
                          <tr>
                            <td colSpan={8} className="px-3 py-2 bg-muted/20">
                              <div className="text-xs">
                                <p className="font-semibold text-muted-foreground mb-1">Elementi tecnici:</p>
                                <div className="flex flex-wrap gap-1">
                                  {m.atleta_ai.elementi.map((el, ei) => (
                                    <span
                                      key={ei}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border"
                                    >
                                      <span className="font-mono font-medium">{el.nome}</span>
                                      <span className="text-muted-foreground">{el.score.toFixed(2)}</span>
                                      {el.info_flag && (
                                        <span className="text-destructive font-bold">{el.info_flag}</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    set_parsed(null);
                    set_matches([]);
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Annulla
                </Button>
                <Button onClick={handle_save} disabled={saving}>
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvataggio…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Conferma e salva ({matches.length} atleti)
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ImportGaraPdf;
