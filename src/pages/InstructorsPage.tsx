import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { use_istruttori, use_lezioni_private, use_corsi } from "@/hooks/use-supabase-data";
import { use_upsert_istruttore, use_save_disponibilita, use_elimina_istruttore } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowLeft, Euro, Clock, TrendingUp } from "lucide-react";
import FormDialog, { FormField } from "@/components/forms/FormDialog";
import { toast } from "@/hooks/use-toast";
import { supabase, DEMO_CLUB_ID } from "@/lib/supabase";

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const TIPI_CONTRATTO = [
  { value: "orario", label: "A ore (costo al minuto)" },
  { value: "fisso_mensile", label: "Fisso mensile" },
  { value: "fisso_corsi", label: "Fisso corsi + variabile lezioni private" },
  { value: "misto", label: "Fisso mensile + variabile lezioni private" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function get_mese_label(anno: number, mese: number) {
  return new Date(anno, mese - 1, 1).toLocaleDateString("it-CH", { month: "long", year: "numeric" });
}

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

// ─── Tab Compenso ──────────────────────────────────────────────────────────────
const TabCompenso: React.FC<{
  istruttore: any;
  lezioni: any[];
  corsi: any[];
  on_save_contratto: (data: any) => void;
  saving: boolean;
}> = ({ istruttore, lezioni, corsi, on_save_contratto, saving }) => {
  const now = new Date();
  const [anno, set_anno] = useState(now.getFullYear());
  const [mese, set_mese] = useState(now.getMonth() + 1);
  const [contratto_form, set_contratto_form] = useState({
    tipo_contratto: istruttore.tipo_contratto || "orario",
    costo_minuto_lezione_privata: istruttore.costo_minuto || 0,
    compenso_fisso_mensile: istruttore.compenso_fisso_mensile || 0,
    compenso_fisso_corsi: istruttore.compenso_fisso_corsi || 0,
  });

  // Calcola ore lezioni private nel mese selezionato
  const lezioni_mese = useMemo(() => {
    return lezioni.filter((l) => {
      if (l.istruttore_id !== istruttore.id) return false;
      if (!l.data) return false;
      const d = new Date(l.data + "T00:00:00");
      return d.getFullYear() === anno && d.getMonth() + 1 === mese;
    });
  }, [lezioni, istruttore.id, anno, mese]);

  const minuti_lezioni_private = lezioni_mese.reduce((s: number, l: any) => s + (l.durata_minuti || 20), 0);
  const ore_lezioni_private = minuti_lezioni_private / 60;

  // Calcola ore corsi nel mese (ore settimanali x settimane del mese)
  const corsi_istruttore = useMemo(() => {
    return corsi.filter((c: any) => c.istruttori_ids?.includes(istruttore.id) && c.attivo);
  }, [corsi, istruttore.id]);

  const settimane_mese = useMemo(() => {
    // Conta quante volte ogni giorno della settimana appare nel mese
    const giorni_in_mese = new Date(anno, mese, 0).getDate();
    const conteggio: Record<string, number> = {};
    for (let d = 1; d <= giorni_in_mese; d++) {
      const dow = new Date(anno, mese - 1, d).getDay();
      const nome = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][dow];
      conteggio[nome] = (conteggio[nome] || 0) + 1;
    }
    return conteggio;
  }, [anno, mese]);

  const minuti_corsi = useMemo(() => {
    return corsi_istruttore.reduce((s: number, c: any) => {
      const durata =
        time_to_min(c.ora_fine?.slice(0, 5) || "00:00") - time_to_min(c.ora_inizio?.slice(0, 5) || "00:00");
      const settimane = settimane_mese[c.giorno] || 4;
      return s + durata * settimane;
    }, 0);
  }, [corsi_istruttore, settimane_mese]);

  const ore_corsi = minuti_corsi / 60;
  const ore_totali = ore_lezioni_private + ore_corsi;

  // Calcola compenso in base al tipo di contratto
  const compenso = useMemo(() => {
    const tipo = contratto_form.tipo_contratto;
    const costo_min = Number(contratto_form.costo_minuto_lezione_privata);
    const fisso_mensile = Number(contratto_form.compenso_fisso_mensile);
    const fisso_corsi = Number(contratto_form.compenso_fisso_corsi);

    switch (tipo) {
      case "orario":
        return (minuti_lezioni_private + minuti_corsi) * costo_min;
      case "fisso_mensile":
        return fisso_mensile;
      case "fisso_corsi":
        return fisso_corsi + minuti_lezioni_private * costo_min;
      case "misto":
        return fisso_mensile + minuti_lezioni_private * costo_min;
      default:
        return 0;
    }
  }, [contratto_form, minuti_lezioni_private, minuti_corsi]);

  const prev_mese = () => {
    if (mese === 1) {
      set_anno((a) => a - 1);
      set_mese(12);
    } else set_mese((m) => m - 1);
  };
  const next_mese = () => {
    if (mese === 12) {
      set_anno((a) => a + 1);
      set_mese(1);
    } else set_mese((m) => m + 1);
  };

  return (
    <div className="space-y-6">
      {/* Configurazione contratto */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tipo di contratto</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPI_CONTRATTO.map((tc) => (
            <div
              key={tc.value}
              onClick={() => set_contratto_form((p) => ({ ...p, tipo_contratto: tc.value }))}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all
                ${
                  contratto_form.tipo_contratto === tc.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
            >
              <p className="text-sm font-medium text-foreground">{tc.label}</p>
            </div>
          ))}
        </div>

        {/* Campi in base al tipo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {(contratto_form.tipo_contratto === "orario" ||
            contratto_form.tipo_contratto === "fisso_corsi" ||
            contratto_form.tipo_contratto === "misto") && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Costo al minuto (lezioni private)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={contratto_form.costo_minuto_lezione_privata}
                  onChange={(e) =>
                    set_contratto_form((p) => ({ ...p, costo_minuto_lezione_privata: parseFloat(e.target.value) || 0 }))
                  }
                  className="pl-11"
                />
              </div>
            </div>
          )}

          {(contratto_form.tipo_contratto === "fisso_mensile" || contratto_form.tipo_contratto === "misto") && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Compenso fisso mensile
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={contratto_form.compenso_fisso_mensile}
                  onChange={(e) =>
                    set_contratto_form((p) => ({ ...p, compenso_fisso_mensile: parseFloat(e.target.value) || 0 }))
                  }
                  className="pl-11"
                />
              </div>
            </div>
          )}

          {contratto_form.tipo_contratto === "fisso_corsi" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Compenso fisso corsi
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={contratto_form.compenso_fisso_corsi}
                  onChange={(e) =>
                    set_contratto_form((p) => ({ ...p, compenso_fisso_corsi: parseFloat(e.target.value) || 0 }))
                  }
                  className="pl-11"
                />
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={() => on_save_contratto(contratto_form)}
          disabled={saving}
          size="sm"
          className="bg-primary hover:bg-primary/90"
        >
          {saving ? "..." : "💾 Salva configurazione contratto"}
        </Button>
      </div>

      {/* Selettore mese */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev_mese}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <h3 className="text-sm font-bold text-foreground capitalize">{get_mese_label(anno, mese)}</h3>
        <button
          onClick={next_mese}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          →
        </button>
      </div>

      {/* KPI ore e compenso */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Ore lezioni private",
            value: `${ore_lezioni_private.toFixed(1)}h`,
            icon: Clock,
            color: "text-primary",
          },
          { label: "Ore corsi", value: `${ore_corsi.toFixed(1)}h`, icon: Clock, color: "text-orange-500" },
          { label: "Ore totali", value: `${ore_totali.toFixed(1)}h`, icon: TrendingUp, color: "text-success" },
          { label: "Compenso stimato", value: `CHF ${compenso.toFixed(2)}`, icon: Euro, color: "text-foreground" },
        ].map((kpi, i) => (
          <div key={i} className="bg-card rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Dettaglio lezioni private del mese */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Lezioni private ({lezioni_mese.length})
        </h3>
        {lezioni_mese.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna lezione privata in questo mese.</p>
        ) : (
          <div className="space-y-2">
            {lezioni_mese.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg text-sm">
                <span className="text-foreground">
                  {new Date(l.data + "T00:00:00").toLocaleDateString("it-CH", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                  {" · "}
                  {l.ora_inizio?.slice(0, 5)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{l.durata_minuti || 20} min</span>
                  {contratto_form.tipo_contratto !== "fisso_mensile" && (
                    <span className="font-semibold text-primary tabular-nums">
                      CHF {((l.durata_minuti || 20) * Number(contratto_form.costo_minuto_lezione_privata)).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dettaglio corsi */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Corsi attivi ({corsi_istruttore.length})
        </h3>
        {corsi_istruttore.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun corso assegnato.</p>
        ) : (
          <div className="space-y-2">
            {corsi_istruttore.map((c: any) => {
              const durata =
                time_to_min(c.ora_fine?.slice(0, 5) || "00:00") - time_to_min(c.ora_inizio?.slice(0, 5) || "00:00");
              const settimane = settimane_mese[c.giorno] || 4;
              const ore_corso = (durata * settimane) / 60;
              return (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-foreground">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.giorno} · {c.ora_inizio?.slice(0, 5)}–{c.ora_fine?.slice(0, 5)} · {settimane} settimane
                    </p>
                  </div>
                  <span className="text-muted-foreground tabular-nums">{ore_corso.toFixed(1)}h</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const InstructorsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: istruttori = [], isLoading } = use_istruttori();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: corsi = [] } = use_corsi();
  const upsert = use_upsert_istruttore();
  const save_disp = use_save_disponibilita();
  const elimina = use_elimina_istruttore();
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [disp_local, set_disp_local] = useState<Record<string, { ora_inizio: string; ora_fine: string }[]>>({});
  const [saving_contratto, set_saving_contratto] = useState(false);

  const fields: FormField[] = [
    { key: "nome", label: t("nome"), required: true },
    { key: "cognome", label: t("cognome"), required: true },
    { key: "email", label: t("email"), type: "email" },
    { key: "telefono", label: t("telefono") },
    { key: "costo_minuto_lezione_privata", label: t("costo_minuto"), type: "number" },
    { key: "attivo", label: t("attivo"), type: "checkbox" },
    { key: "note", label: t("note"), type: "textarea" },
  ];

  const open_new = () => {
    set_form_data({ attivo: true });
    set_form_open(true);
  };

  const open_edit = (i: any) => {
    set_form_data({
      id: i.id,
      nome: i.nome,
      cognome: i.cognome,
      email: i.email,
      telefono: i.telefono,
      costo_minuto_lezione_privata: i.costo_minuto,
      attivo: i.stato === "attivo",
      note: i.note,
    });
    set_form_open(true);
  };

  const handle_submit = async () => {
    await upsert.mutateAsync(form_data);
    set_form_open(false);
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(form_data.id);
      set_form_open(false);
      set_selected_id(null);
      toast({ title: "🗑️ Istruttore eliminato correttamente" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  const handle_save_contratto = async (data: any) => {
    if (!selected_id) return;
    set_saving_contratto(true);
    try {
      const { error } = await supabase
        .from("istruttori")
        .update({
          tipo_contratto: data.tipo_contratto,
          costo_minuto_lezione_privata: data.costo_minuto_lezione_privata,
          compenso_fisso_mensile: data.compenso_fisso_mensile,
          compenso_fisso_corsi: data.compenso_fisso_corsi,
        })
        .eq("id", selected_id);
      if (error) throw error;
      toast({ title: "✅ Contratto salvato" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio contratto", description: err?.message, variant: "destructive" });
    } finally {
      set_saving_contratto(false);
    }
  };

  const open_detail = (i: any) => {
    set_selected_id(i.id);
    set_disp_local(JSON.parse(JSON.stringify(i.disponibilita || {})));
  };

  const add_slot = (giorno: string) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: [...(prev[giorno] || []), { ora_inizio: "14:00", ora_fine: "18:00" }],
    }));
  };

  const remove_slot = (giorno: string, idx: number) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: (prev[giorno] || []).filter((_, i) => i !== idx),
    }));
  };

  const update_slot = (giorno: string, idx: number, field: "ora_inizio" | "ora_fine", value: string) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: (prev[giorno] || []).map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const save_disponibilita = async () => {
    if (!selected_id) return;
    const deduped: Record<string, { ora_inizio: string; ora_fine: string }[]> = {};
    for (const [giorno, slots] of Object.entries(disp_local)) {
      const seen = new Set<string>();
      deduped[giorno] = [];
      for (const s of slots) {
        const key = `${s.ora_inizio}-${s.ora_fine}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped[giorno].push(s);
      }
    }
    set_disp_local(deduped);
    await save_disp.mutateAsync({ istruttore_id: selected_id, disponibilita: deduped });
  };

  const selected = istruttori.find((i: any) => i.id === selected_id);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  if (selected) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => set_selected_id(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("istruttori")}
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {selected.nome} {selected.cognome}
          </h1>
          <Button variant="outline" size="sm" onClick={() => open_edit(selected)}>
            {t("modifica")}
          </Button>
        </div>

        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Informazioni</TabsTrigger>
            <TabsTrigger value="compenso">💶 Compenso & Ore</TabsTrigger>
            <TabsTrigger value="disponibilita">Disponibilità</TabsTrigger>
          </TabsList>

          {/* Tab info */}
          <TabsContent value="info" className="mt-6">
            <div className="bg-card rounded-xl shadow-card p-6 space-y-3 max-w-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("email")}</span>
                <span className="text-foreground">{selected.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("telefono")}</span>
                <span className="text-foreground">{selected.telefono}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("costo_minuto")}</span>
                <span className="text-foreground tabular-nums">CHF {selected.costo_minuto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tipo contratto</span>
                <span className="text-foreground">
                  {TIPI_CONTRATTO.find((tc) => tc.value === selected.tipo_contratto)?.label || "A ore"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("stato")}</span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${selected.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
                />
              </div>
              {selected.note && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Note</p>
                  <p className="text-sm text-foreground">{selected.note}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab compenso */}
          <TabsContent value="compenso" className="mt-6">
            <TabCompenso
              istruttore={selected}
              lezioni={lezioni}
              corsi={corsi}
              on_save_contratto={handle_save_contratto}
              saving={saving_contratto}
            />
          </TabsContent>

          {/* Tab disponibilità */}
          <TabsContent value="disponibilita" className="mt-6">
            <div className="bg-card rounded-xl shadow-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  {t("disponibilita")}
                </h2>
                <Button size="sm" onClick={save_disponibilita} disabled={save_disp.isPending}>
                  {save_disp.isPending ? "..." : t("salva")}
                </Button>
              </div>
              <div className="space-y-4">
                {GIORNI.map((giorno) => {
                  const slots = disp_local[giorno] || [];
                  return (
                    <div key={giorno} className="border border-border/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{giorno}</span>
                        <Button variant="ghost" size="sm" onClick={() => add_slot(giorno)} className="h-7 text-xs">
                          <Plus className="w-3 h-3 mr-1" /> Slot
                        </Button>
                      </div>
                      {slots.length === 0 && <p className="text-xs text-muted-foreground">Nessuno slot</p>}
                      {slots.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-1">
                          <Input
                            type="time"
                            value={s.ora_inizio}
                            onChange={(e) => update_slot(giorno, idx, "ora_inizio", e.target.value)}
                            className="w-28 h-8 text-xs"
                          />
                          <span className="text-muted-foreground text-xs">—</span>
                          <Input
                            type="time"
                            value={s.ora_fine}
                            onChange={(e) => update_slot(giorno, idx, "ora_fine", e.target.value)}
                            className="w-28 h-8 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove_slot(giorno, idx)}
                            className="h-7 w-7 p-0 text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <FormDialog
          open={form_open}
          on_close={() => set_form_open(false)}
          title={form_data.id ? t("modifica") : t("nuovo_istruttore")}
          fields={fields}
          values={form_data}
          on_change={(k, v) => set_form_data((p) => ({ ...p, [k]: v }))}
          on_submit={handle_submit}
          on_delete={form_data.id ? handle_delete : undefined}
          delete_loading={elimina.isPending}
          loading={upsert.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t("istruttori")}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}>
          <Plus className="w-4 h-4 mr-2" /> {t("nuovo_istruttore")}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {istruttori.map((i: any) => (
          <div
            key={i.id}
            onClick={() => open_detail(i)}
            className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {i.nome[0]}
                {i.cognome[0]}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {i.nome} {i.cognome}
                </p>
                <p className="text-xs text-muted-foreground">{i.email}</p>
              </div>
              <span
                className={`ml-auto inline-block w-2 h-2 rounded-full ${i.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("telefono")}</span>
                <span className="text-foreground">{i.telefono}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contratto</span>
                <span className="text-foreground text-xs">
                  {TIPI_CONTRATTO.find((tc) => tc.value === i.tipo_contratto)?.label || "A ore"}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {t("disponibilita")}
              </p>
              <div className="flex flex-wrap gap-1">
                {GIORNI.map((d) => (
                  <Badge
                    key={d}
                    variant={i.disponibilita[d]?.length > 0 ? "default" : "secondary"}
                    className="text-[10px] px-1.5"
                  >
                    {d.slice(0, 3)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <FormDialog
        open={form_open}
        on_close={() => set_form_open(false)}
        title={form_data.id ? t("modifica") : t("nuovo_istruttore")}
        fields={fields}
        values={form_data}
        on_change={(k, v) => set_form_data((p) => ({ ...p, [k]: v }))}
        on_submit={handle_submit}
        on_delete={form_data.id ? handle_delete : undefined}
        delete_loading={elimina.isPending}
        loading={upsert.isPending}
      />
    </div>
  );
};

export default InstructorsPage;
