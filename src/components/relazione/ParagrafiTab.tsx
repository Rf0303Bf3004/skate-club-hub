import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, RotateCw, Sparkles, Save, X, Pencil } from "lucide-react";
import TabHeaderInfo from "./TabHeaderInfo";
import {
  AREE_ORDINATE, AREA_LABELS, ORDINE_LABELS,
  generateAllParagraphs, type Tono, type AreaId,
} from "@/lib/paragraphGenerator";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const tk = (key: string, opts?: any) => i18n.t(`relazione.paragrafi_tab.${key}`, { ns: "dashboard", ...(opts ?? {}) }) as string;

interface Props { club_id: string; stagione_id: string; }

const ORDINE_COLORS: Record<number, string> = {
  1: "bg-amber-100 text-amber-800 border-amber-300",
  2: "bg-blue-100 text-blue-800 border-blue-300",
  3: "bg-violet-100 text-violet-800 border-violet-300",
  4: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

interface Paragrafo {
  id: string;
  area_id: string;
  paragrafo_ordine: number;
  tono: string;
  contenuto: string;
  is_edited: boolean;
}

export default function ParagrafiTab({ club_id, stagione_id }: Props) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const [tono, set_tono] = useState<Tono>("soci");
  const [generating, set_generating] = useState(false);
  const [progress, set_progress] = useState<{ area: number; label: string; total: number } | null>(null);
  const [editing_id, set_editing_id] = useState<string | null>(null);
  const [edit_text, set_edit_text] = useState("");

  const { data: paragrafi = [], isLoading } = useQuery({
    queryKey: ["relazione_paragrafi", club_id, stagione_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_paragrafi_auto" as any).select("*")
        .eq("club_id", club_id).eq("stagione_id", stagione_id);
      if (error) throw error;
      return (data ?? []) as any as Paragrafo[];
    },
  });

  // Auto-genera al primo accesso se vuoto
  useEffect(() => {
    if (isLoading || generating) return;
    if (paragrafi.length === 0 && club_id && stagione_id) {
      void run_generation(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, paragrafi.length, club_id, stagione_id]);

  async function run_generation(showToast: boolean) {
    set_generating(true);
    set_progress({ area: 0, label: "", total: 9 });
    try {
      const res = await generateAllParagraphs(club_id, stagione_id, (p) => {
        set_progress({ area: p.area_idx, label: p.area_label, total: p.total });
      });
      await qc.invalidateQueries({ queryKey: ["relazione_paragrafi", club_id, stagione_id] });
      if (showToast) toast.success(tk("toast_generati", { inserted: res.inserted, skipped: res.skipped }));
    } catch (e: any) {
      console.error(e);
      toast.error(tk("toast_errore_generazione", { errore: e?.message ?? e }));
    } finally {
      set_generating(false);
      set_progress(null);
    }
  }

  const m_save = useMutation({
    mutationFn: async ({ id, contenuto }: { id: string; contenuto: string }) => {
      const { error } = await supabase.from("relazioni_paragrafi_auto" as any)
        .update({ contenuto, is_edited: true, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tk("toast_salvato"));
      qc.invalidateQueries({ queryKey: ["relazione_paragrafi", club_id, stagione_id] });
      set_editing_id(null);
    },
    onError: (e: any) => toast.error(tk("toast_errore", { errore: e?.message ?? e })),
  });

  const m_regen_single = useMutation({
    mutationFn: async (p: Paragrafo) => {
      // re-run full generation but only for this row would be expensive; we call full generator and rely on skip.
      // For "rigenera singolo" we delete this row first (so it's regenerated), then call gen.
      const { error: derr } = await supabase.from("relazioni_paragrafi_auto" as any).delete().eq("id", p.id);
      if (derr) throw derr;
      await generateAllParagraphs(club_id, stagione_id);
    },
    onSuccess: () => {
      toast.success(tk("toast_rigenerato"));
      qc.invalidateQueries({ queryKey: ["relazione_paragrafi", club_id, stagione_id] });
    },
    onError: (e: any) => toast.error(tk("toast_errore", { errore: e?.message ?? e })),
  });

  // Indice: per area -> per ordine -> paragrafo
  const map = useMemo(() => {
    const m: Record<string, Record<number, Paragrafo>> = {};
    for (const p of paragrafi.filter((x) => x.tono === tono)) {
      m[p.area_id] = m[p.area_id] ?? {};
      m[p.area_id][p.paragrafo_ordine] = p;
    }
    return m;
  }, [paragrafi, tono]);

  const word_count = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <TabHeaderInfo
        icon={Sparkles}
        titolo={t("relazione.paragrafi_tab.header_titolo")}
        testo={t("relazione.paragrafi_tab.header_testo")}
        collapsible_label={t("relazione.paragrafi_tab.header_collapsible")}
      >
        <div className="space-y-2">
          <p>{t("relazione.paragrafi_tab.help_intro")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t("relazione.paragrafi_tab.help_1")}</li>
            <li>{t("relazione.paragrafi_tab.help_2")}</li>
            <li>{t("relazione.paragrafi_tab.help_3")}</li>
          </ul>
          <p className="pt-2">
            <strong>{t("relazione.paragrafi_tab.help_warn_strong")}</strong>{" "}
            {t("relazione.paragrafi_tab.help_warn")} <em>{t("relazione.paragrafi_tab.help_warn_tab")}</em>.
          </p>
        </div>
      </TabHeaderInfo>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border border-border rounded-md bg-card">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{t("relazione.paragrafi_tab.mostra_tono")}</span>
          <Select value={tono} onValueChange={(v) => set_tono(v as Tono)}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soci">{t("relazione.paragrafi_tab.tono_soci")}</SelectItem>
              <SelectItem value="formale">{t("relazione.paragrafi_tab.tono_formale")}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {t("relazione.paragrafi_tab.contatore", { count: paragrafi.filter((p) => p.tono === tono).length })}
          </span>
        </div>
        <Button onClick={() => run_generation(true)} disabled={generating} className="gap-2">
          <Sparkles className="w-4 h-4" />
          {generating ? t("relazione.paragrafi_tab.generazione_in_corso") : t("relazione.paragrafi_tab.rigenera_tutti")}
        </Button>
      </div>

      {generating && progress && (
        <div className="p-4 border border-border rounded-md bg-muted/30 space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t("relazione.paragrafi_tab.progress", { area: progress.area, total: progress.total })}</span>
            <span className="text-muted-foreground">{progress.label}</span>
          </div>
          <Progress value={(progress.area / progress.total) * 100} />
        </div>
      )}

      <div className="space-y-3">
        {AREE_ORDINATE.map((area) => {
          const paras = map[area] ?? {};
          const popolati = Object.keys(paras).length;
          return (
            <Collapsible key={area} defaultOpen>
              <div className="border border-border rounded-md bg-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-serif text-lg text-foreground">{AREA_LABELS[area as AreaId]}</h3>
                      <span className="text-xs text-muted-foreground">{t("relazione.paragrafi_tab.popolati", { count: popolati })}</span>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {[1, 2, 3, 4].map((ord) => {
                      const p = paras[ord];
                      if (!p) {
                        return (
                          <div key={ord} className="p-3 border border-dashed border-border rounded-md text-sm text-muted-foreground">
                            {t("relazione.paragrafi_tab.non_generato", { label: ORDINE_LABELS[ord] })}
                          </div>
                        );
                      }
                      const is_editing = editing_id === p.id;
                      return (
                        <div key={ord} className="p-3 border border-border rounded-md bg-background space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={ORDINE_COLORS[ord]}>{ord} · {ORDINE_LABELS[ord]}</Badge>
                              {p.is_edited
                                ? <Badge variant="secondary" className="bg-orange-100 text-orange-800">{t("relazione.paragrafi_tab.badge_modificato")}</Badge>
                                : <Badge variant="secondary" className="bg-slate-100 text-slate-700">{t("relazione.paragrafi_tab.badge_auto")}</Badge>}
                            </div>
                            {!is_editing && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => { set_editing_id(p.id); set_edit_text(p.contenuto); }} className="h-8 gap-1">
                                  <Pencil className="w-3.5 h-3.5" /> {t("relazione.paragrafi_tab.modifica")}
                                </Button>
                                {p.is_edited ? (
                                  <ConfirmButton
                                    titolo={t("relazione.paragrafi_tab.confirm_titolo")}
                                    descrizione={t("relazione.paragrafi_tab.confirm_desc")}
                                    conferma_label={t("relazione.paragrafi_tab.rigenera")}
                                    on_conferma={() => m_regen_single.mutate(p)}
                                  >
                                    <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={m_regen_single.isPending}>
                                      <RotateCw className="w-3.5 h-3.5" /> {t("relazione.paragrafi_tab.rigenera")}
                                    </Button>
                                  </ConfirmButton>
                                ) : (
                                  <Button size="sm" variant="ghost" className="h-8 gap-1"
                                    disabled={m_regen_single.isPending}
                                    onClick={() => m_regen_single.mutate(p)}>
                                    <RotateCw className="w-3.5 h-3.5" /> {t("relazione.paragrafi_tab.rigenera")}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          {is_editing ? (
                            <div className="space-y-2">
                              <Textarea value={edit_text} onChange={(e) => set_edit_text(e.target.value)} rows={6} className="font-serif text-sm leading-relaxed" />
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{t("relazione.paragrafi_tab.parole", { count: word_count(edit_text) })}</span>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => set_editing_id(null)} className="gap-1">
                                    <X className="w-3.5 h-3.5" /> {t("relazione.paragrafi_tab.annulla")}
                                  </Button>
                                  <Button size="sm" onClick={() => m_save.mutate({ id: p.id, contenuto: edit_text })} disabled={m_save.isPending} className="gap-1">
                                    <Save className="w-3.5 h-3.5" /> {t("relazione.paragrafi_tab.salva")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed font-serif text-foreground whitespace-pre-wrap">{p.contenuto}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
