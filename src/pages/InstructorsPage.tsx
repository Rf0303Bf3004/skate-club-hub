import React, { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { use_istruttori, use_lezioni_private, use_corsi, use_campi } from "@/hooks/use-supabase-data";
import { use_upsert_istruttore, use_save_disponibilita, use_elimina_istruttore } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowLeft, Euro, Clock, TrendingUp, Download } from "lucide-react";
import FormDialog, { FormField } from "@/components/forms/FormDialog";
import { toast } from "@/hooks/use-toast";
import { supabase, DEMO_CLUB_ID } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const TIPI_CONTRATTO = [
  { value: "orario", label: "A ore (costo al minuto)" },
  { value: "fisso_mensile", label: "Fisso mensile" },
  { value: "fisso_corsi", label: "Fisso corsi + variabile lezioni private" },
  { value: "misto", label: "Fisso mensile + variabile lezioni private" },
];

// ─── Helpers ──────────────────────────────────────────────
function get_mese_label(anno: number, mese: number) {
  return new Date(anno, mese - 1, 1).toLocaleDateString("it-CH", { month: "long", year: "numeric" });
}

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function ore_fmt(ore: number): string {
  const h = Math.floor(ore);
  const m = Math.round((ore - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

// ─── Tab Ore Lavoro ────────────────────────────────────────
const TabOreLavoro: React.FC<{
  istruttore: any;
  lezioni: any[];
  corsi: any[];
  campi: any[];
}> = ({ istruttore, lezioni, corsi, campi }) => {
  const qc = useQueryClient();
  const now = new Date();
  const [anno, set_anno] = useState(now.getFullYear());
  const [mese, set_mese] = useState(now.getMonth() + 1);
  const [record, set_record] = useState<any>(null);
  const [ore_extra, set_ore_extra] = useState(0);
  const [note_extra, set_note_extra] = useState("");
  const [ore_gare_manual, set_ore_gare_manual] = useState(0);
  const [saving, set_saving] = useState(false);
  const [loading_record, set_loading_record] = useState(false);

  // Carica record dal DB per mese/anno selezionato
  useEffect(() => {
    const load = async () => {
      set_loading_record(true);
      try {
        const { data } = await supabase
          .from("ore_lavoro_istruttori")
          .select("*")
          .eq("istruttore_id", istruttore.id)
          .eq("anno", anno)
          .eq("mese", mese)
          .maybeSingle();
        set_record(data);
        set_ore_extra(data?.ore_extra ?? 0);
        set_note_extra(data?.note_extra ?? "");
        set_ore_gare_manual(data?.ore_gare ?? 0);
      } finally {
        set_loading_record(false);
      }
    };
    load();
  }, [istruttore.id, anno, mese]);

  // Calcola ore lezioni private
  const lezioni_mese = useMemo(
    () =>
      lezioni.filter((l) => {
        if (l.istruttore_id !== istruttore.id || !l.data) return false;
        const d = new Date(l.data + "T00:00:00");
        return d.getFullYear() === anno && d.getMonth() + 1 === mese;
      }),
    [lezioni, istruttore.id, anno, mese],
  );

  const minuti_lezioni = lezioni_mese.reduce((s, l: any) => s + (l.durata_minuti || 20), 0);
  const ore_lezioni = minuti_lezioni / 60;

  // Calcola ore corsi
  const corsi_istruttore = useMemo(
    () => corsi.filter((c: any) => c.istruttori_ids?.includes(istruttore.id) && c.attivo),
    [corsi, istruttore.id],
  );

  const settimane_mese = useMemo(() => {
    const giorni_in_mese = new Date(anno, mese, 0).getDate();
    const conteggio: Record<string, number> = {};
    for (let d = 1; d <= giorni_in_mese; d++) {
      const dow = new Date(anno, mese - 1, d).getDay();
      const nome = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][dow];
      conteggio[nome] = (conteggio[nome] || 0) + 1;
    }
    return conteggio;
  }, [anno, mese]);

  const minuti_corsi = useMemo(
    () =>
      corsi_istruttore.reduce((s: number, c: any) => {
        const durata =
          time_to_min(c.ora_fine?.slice(0, 5) || "00:00") - time_to_min(c.ora_inizio?.slice(0, 5) || "00:00");
        return s + durata * (settimane_mese[c.giorno] || 4);
      }, 0),
    [corsi_istruttore, settimane_mese],
  );

  const ore_corsi = minuti_corsi / 60;

  // Calcola ore campi nel mese
  const ore_campi = useMemo(() => {
    let totale = 0;
    for (const campo of campi) {
      if (!campo.data_inizio || !campo.data_fine) continue;
      const inizio = new Date(campo.data_inizio + "T00:00:00");
      const fine = new Date(campo.data_fine + "T00:00:00");
      if (inizio.getFullYear() === anno && inizio.getMonth() + 1 === mese) {
        const giorni = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        totale += giorni * 8; // assume 8h al giorno per campo
      }
    }
    return totale;
  }, [campi, anno, mese]);

  const ore_totali = ore_lezioni + ore_corsi + ore_campi + ore_gare_manual + ore_extra;

  // Costo club
  const costo_lezioni = ore_lezioni * (istruttore.costo_orario_lezioni || 0);
  const costo_corsi = ore_corsi * (istruttore.costo_orario_corsi || 0);
  const costo_extra =
    (ore_campi + ore_gare_manual + ore_extra) * (istruttore.costo_orario_corsi || istruttore.costo_orario_lezioni || 0);
  const costo_totale_club = costo_lezioni + costo_corsi + costo_extra;

  const handle_save = async () => {
    set_saving(true);
    try {
      const payload = {
        istruttore_id: istruttore.id,
        anno,
        mese,
        ore_corsi,
        ore_lezioni_private: ore_lezioni,
        ore_campi,
        ore_gare: ore_gare_manual,
        ore_extra,
        note_extra,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("ore_lavoro_istruttori")
        .upsert(payload, { onConflict: "istruttore_id,anno,mese" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["ore_lavoro"] });
      toast({ title: "✅ Ore lavoro salvate" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const handle_export_csv = () => {
    const rows = [
      ["Istruttore", `${istruttore.nome} ${istruttore.cognome}`],
      ["Mese", get_mese_label(anno, mese)],
      [""],
      ["Categoria", "Ore", "Costo club (CHF)"],
      ["Lezioni private", ore_lezioni.toFixed(2), costo_lezioni.toFixed(2)],
      ["Corsi", ore_corsi.toFixed(2), costo_corsi.toFixed(2)],
      ["Campi allenamento", ore_campi.toFixed(2), ""],
      ["Accompagnamento gare", ore_gare_manual.toFixed(2), ""],
      ["Extra/Altro", ore_extra.toFixed(2), ""],
      ["TOTALE", ore_totali.toFixed(2), costo_totale_club.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ore_${istruttore.cognome}_${anno}_${String(mese).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    <div className="space-y-5">
      {/* Navigazione mese */}
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

      {/* KPI ore */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Lezioni private", ore: ore_lezioni, color: "text-primary", costo: costo_lezioni, tipo: "lezioni" },
          { label: "Corsi", ore: ore_corsi, color: "text-orange-500", costo: costo_corsi, tipo: "corsi" },
          { label: "Ore totali", ore: ore_totali, color: "text-success", costo: null, tipo: null },
        ].map((kpi, i) => (
          <div key={i} className="bg-card rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-3.5 h-3.5 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${kpi.color}`}>{ore_fmt(kpi.ore)}</p>
            {kpi.costo !== null && kpi.costo > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                Costo club: CHF {kpi.costo.toFixed(2)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Tabella dettaglio ore */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Dettaglio ore mensili</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handle_export_csv} className="h-7 text-xs gap-1.5">
              <Download className="w-3 h-3" /> CSV
            </Button>
            <Button
              size="sm"
              onClick={handle_save}
              disabled={saving}
              className="h-7 text-xs bg-primary hover:bg-primary/90"
            >
              {saving ? "..." : "💾 Salva"}
            </Button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-2.5 text-xs font-bold text-muted-foreground">Categoria</th>
              <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">Ore</th>
              <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">Costo/h club</th>
              <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">Totale club</th>
            </tr>
          </thead>
          <tbody>
            {/* Lezioni private — calcolate automaticamente */}
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Lezioni private</p>
                <p className="text-xs text-muted-foreground">{lezioni_mese.length} lezioni · automatico</p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{ore_fmt(ore_lezioni)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                CHF {(istruttore.costo_orario_lezioni || 0).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">
                CHF {costo_lezioni.toFixed(2)}
              </td>
            </tr>

            {/* Corsi — calcolati automaticamente */}
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Corsi</p>
                <p className="text-xs text-muted-foreground">{corsi_istruttore.length} corsi attivi · automatico</p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{ore_fmt(ore_corsi)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                CHF {(istruttore.costo_orario_corsi || 0).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">
                CHF {costo_corsi.toFixed(2)}
              </td>
            </tr>

            {/* Campi — calcolati automaticamente */}
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Campi allenamento</p>
                <p className="text-xs text-muted-foreground">automatico (8h/giorno)</p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{ore_fmt(ore_campi)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
            </tr>

            {/* Accompagnamento gare — manuale */}
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Accompagnamento gare</p>
                <p className="text-xs text-muted-foreground">inserimento manuale</p>
              </td>
              <td className="px-4 py-3 text-right">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={ore_gare_manual}
                  onChange={(e) => set_ore_gare_manual(parseFloat(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
            </tr>

            {/* Extra/Altro — manuale */}
            <tr className="border-b border-border/50">
              <td className="px-4 py-3 space-y-1">
                <p className="font-medium text-foreground">Extra / Riunioni / Altro</p>
                <input
                  type="text"
                  value={note_extra}
                  onChange={(e) => set_note_extra(e.target.value)}
                  placeholder="Note (opzionale)..."
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </td>
              <td className="px-4 py-3 text-right">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={ore_extra}
                  onChange={(e) => set_ore_extra(parseFloat(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
            </tr>

            {/* Totale */}
            <tr className="bg-muted/20">
              <td className="px-4 py-3 font-bold text-foreground">TOTALE</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">{ore_fmt(ore_totali)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-primary">
                CHF {costo_totale_club.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Dettaglio lezioni del mese */}
      {lezioni_mese.length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-5 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Dettaglio lezioni private ({lezioni_mese.length})
          </h3>
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
              <span className="text-muted-foreground tabular-nums">{l.durata_minuti || 20} min</span>
            </div>
          ))}
        </div>
      )}

      {/* Dettaglio corsi */}
      {corsi_istruttore.length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-5 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Dettaglio corsi ({corsi_istruttore.length})
          </h3>
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
                    {c.giorno} · {c.ora_inizio?.slice(0, 5)}–{c.ora_fine?.slice(0, 5)} · {settimane} sett.
                  </p>
                </div>
                <span className="text-muted-foreground tabular-nums">{ore_fmt(ore_corso)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Tab Compenso (prezzo di vendita) ─────────────────────
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
    costo_orario_corsi: istruttore.costo_orario_corsi || 0,
    costo_orario_lezioni: istruttore.costo_orario_lezioni || 0,
  });

  const lezioni_mese = useMemo(
    () =>
      lezioni.filter((l) => {
        if (l.istruttore_id !== istruttore.id || !l.data) return false;
        const d = new Date(l.data + "T00:00:00");
        return d.getFullYear() === anno && d.getMonth() + 1 === mese;
      }),
    [lezioni, istruttore.id, anno, mese],
  );

  const minuti_lezioni_private = lezioni_mese.reduce((s, l: any) => s + (l.durata_minuti || 20), 0);
  const ore_lezioni_private = minuti_lezioni_private / 60;

  const corsi_istruttore = useMemo(
    () => corsi.filter((c: any) => c.istruttori_ids?.includes(istruttore.id) && c.attivo),
    [corsi, istruttore.id],
  );

  const settimane_mese = useMemo(() => {
    const giorni_in_mese = new Date(anno, mese, 0).getDate();
    const conteggio: Record<string, number> = {};
    for (let d = 1; d <= giorni_in_mese; d++) {
      const dow = new Date(anno, mese - 1, d).getDay();
      const nome = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][dow];
      conteggio[nome] = (conteggio[nome] || 0) + 1;
    }
    return conteggio;
  }, [anno, mese]);

  const minuti_corsi = useMemo(
    () =>
      corsi_istruttore.reduce((s: number, c: any) => {
        const durata =
          time_to_min(c.ora_fine?.slice(0, 5) || "00:00") - time_to_min(c.ora_inizio?.slice(0, 5) || "00:00");
        return s + durata * (settimane_mese[c.giorno] || 4);
      }, 0),
    [corsi_istruttore, settimane_mese],
  );

  const ore_corsi = minuti_corsi / 60;

  const compenso_vendita = useMemo(() => {
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
      {/* Configurazione contratto (prezzo di vendita al cliente) */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Prezzo di vendita al cliente
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">RICAVI</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPI_CONTRATTO.map((tc) => (
            <div
              key={tc.value}
              onClick={() => set_contratto_form((p) => ({ ...p, tipo_contratto: tc.value }))}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all
                ${contratto_form.tipo_contratto === tc.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <p className="text-sm font-medium text-foreground">{tc.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {(contratto_form.tipo_contratto === "orario" ||
            contratto_form.tipo_contratto === "fisso_corsi" ||
            contratto_form.tipo_contratto === "misto") && (
            <Field label="Prezzo al minuto lezioni private (vendita)">
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
            </Field>
          )}
          {(contratto_form.tipo_contratto === "fisso_mensile" || contratto_form.tipo_contratto === "misto") && (
            <Field label="Compenso fisso mensile">
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
            </Field>
          )}
          {contratto_form.tipo_contratto === "fisso_corsi" && (
            <Field label="Compenso fisso corsi">
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
            </Field>
          )}
        </div>
      </div>

      {/* Costo orario club (costo interno) */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Costo orario club (interno)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">
            COSTI
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Quanto paga il club all'istruttore per ogni ora di lavoro. Distinto per tipo di attività.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Costo orario — lezioni private">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF/h</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={contratto_form.costo_orario_lezioni}
                onChange={(e) =>
                  set_contratto_form((p) => ({ ...p, costo_orario_lezioni: parseFloat(e.target.value) || 0 }))
                }
                className="pl-14"
              />
            </div>
          </Field>
          <Field label="Costo orario — corsi e altro">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF/h</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={contratto_form.costo_orario_corsi}
                onChange={(e) =>
                  set_contratto_form((p) => ({ ...p, costo_orario_corsi: parseFloat(e.target.value) || 0 }))
                }
                className="pl-14"
              />
            </div>
          </Field>
        </div>
      </div>

      <Button
        onClick={() => on_save_contratto(contratto_form)}
        disabled={saving}
        size="sm"
        className="bg-primary hover:bg-primary/90"
      >
        {saving ? "..." : "💾 Salva configurazione contratto"}
      </Button>

      {/* Selettore mese e riepilogo ricavi */}
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Ore lezioni private", value: ore_fmt(ore_lezioni_private), icon: Clock, color: "text-primary" },
          { label: "Ore corsi", value: ore_fmt(ore_corsi), icon: Clock, color: "text-orange-500" },
          {
            label: "Ore totali",
            value: ore_fmt(ore_lezioni_private + ore_corsi),
            icon: TrendingUp,
            color: "text-success",
          },
          {
            label: "Ricavo stimato",
            value: `CHF ${compenso_vendita.toFixed(2)}`,
            icon: Euro,
            color: "text-foreground",
          },
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
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────
const InstructorsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: istruttori = [], isLoading } = use_istruttori();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: corsi = [] } = use_corsi();
  const { data: campi = [] } = use_campi();
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
    { key: "costo_minuto_lezione_privata", label: `${t("costo_minuto")} (prezzo vendita)`, type: "number" },
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
          costo_orario_corsi: data.costo_orario_corsi,
          costo_orario_lezioni: data.costo_orario_lezioni,
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
    set_disp_local((prev) => ({ ...prev, [giorno]: (prev[giorno] || []).filter((_, i) => i !== idx) }));
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
            <TabsTrigger value="compenso">💶 Compenso</TabsTrigger>
            <TabsTrigger value="ore">⏱️ Ore Lavoro</TabsTrigger>
            <TabsTrigger value="disponibilita">Disponibilità</TabsTrigger>
          </TabsList>

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
                <span className="text-muted-foreground">Prezzo vendita al minuto</span>
                <span className="text-foreground tabular-nums">CHF {selected.costo_minuto?.toFixed(2)}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Costo orario club — lezioni</span>
                <span className="text-foreground tabular-nums">
                  CHF {(selected.costo_orario_lezioni || 0).toFixed(2)}/h
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Costo orario club — corsi</span>
                <span className="text-foreground tabular-nums">
                  CHF {(selected.costo_orario_corsi || 0).toFixed(2)}/h
                </span>
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

          <TabsContent value="compenso" className="mt-6">
            <TabCompenso
              istruttore={selected}
              lezioni={lezioni}
              corsi={corsi}
              on_save_contratto={handle_save_contratto}
              saving={saving_contratto}
            />
          </TabsContent>

          <TabsContent value="ore" className="mt-6">
            <TabOreLavoro istruttore={selected} lezioni={lezioni} corsi={corsi} campi={campi} />
          </TabsContent>

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
                <span className="text-muted-foreground">Vendita/min</span>
                <span className="text-foreground tabular-nums">CHF {(i.costo_minuto || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo/h club</span>
                <span className="text-foreground tabular-nums text-xs">
                  L: CHF {(i.costo_orario_lezioni || 0).toFixed(0)} · C: CHF {(i.costo_orario_corsi || 0).toFixed(0)}
                </span>
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
