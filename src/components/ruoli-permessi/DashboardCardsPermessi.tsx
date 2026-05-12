import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CARDS, AREE, RUOLI_DASHBOARD, type AreaDashboard } from "@/config/dashboardCards";

type RuoloKey = "presidente" | "segreteria" | "dt" | "istruttore" | "aiuto_monitore";

const DEFAULTS: Record<RuoloKey, string[]> = {
  presidente: CARDS.map((c) => c.codice),
  segreteria: [
    "fatturato_mese","fatturato_anno","da_incassare","fatture_scadute","cash_flow","compensi_mese",
    "atleti_attivi","compleanni_30gg","tessere_sis_scadenza",
    "prossime_gare","da_iscrivere_gare",
    "iscrizioni_pendenti","richieste_private","istruttori_oggi",
    "comunicazione_rapida","ultime_comunicazioni","rsvp_scaduti",
  ],
  dt: [
    "atleti_attivi","atleti_yoy","distribuzione_livelli",
    "atleti_pronti_test","medagliere","prossime_gare","storico_gare_stagione","risultati_yoy",
    "richieste_private","carico_istruttori","presenze_settimana",
    "occupazione_ghiaccio",
    "ultime_comunicazioni",
  ],
  istruttore: ["compensi_mese","atleti_attivi","presenze_settimana","ultime_comunicazioni"],
  aiuto_monitore: ["compensi_mese","ultime_comunicazioni"],
};

const AREA_HEADER_BG: Record<AreaDashboard, string> = {
  finanziaria: "bg-emerald-50 text-emerald-800 border-emerald-200",
  atleti: "bg-blue-50 text-blue-800 border-blue-200",
  sportiva: "bg-amber-50 text-amber-800 border-amber-200",
  operativa: "bg-purple-50 text-purple-800 border-purple-200",
  ghiaccio: "bg-cyan-50 text-cyan-800 border-cyan-200",
  comunicazioni: "bg-rose-50 text-rose-800 border-rose-200",
};

const DashboardCardsPermessi: React.FC = () => {
  const { session } = useAuth();
  const qc = useQueryClient();
  const club_id = session?.club_id;
  const [saving, set_saving] = useState(false);
  const [matrix, set_matrix] = useState<Record<string, Record<string, boolean>>>({});

  const { isLoading } = useQuery({
    queryKey: ["dashboard_card_permessi_admin", club_id],
    queryFn: async () => {
      if (!club_id) return [];
      const { data, error } = await supabase
        .from("dashboard_card_permessi")
        .select("ruolo, codice_card, visibile")
        .eq("club_id", club_id);
      if (error) throw error;
      const m: Record<string, Record<string, boolean>> = {};
      for (const r of RUOLI_DASHBOARD) {
        m[r.codice] = {};
        for (const c of CARDS) {
          if (r.codice === "presidente") {
            m[r.codice][c.codice] = true;
            continue;
          }
          const row = (data ?? []).find((x: any) => x.ruolo === r.codice && x.codice_card === c.codice);
          m[r.codice][c.codice] = row ? row.visibile : true;
        }
      }
      set_matrix(m);
      return data ?? [];
    },
    enabled: !!club_id,
  });

  const cards_per_area = useMemo(() => {
    const map = new Map<AreaDashboard, typeof CARDS>();
    for (const a of AREE) map.set(a.codice, [] as any);
    for (const c of CARDS) (map.get(c.area) as any).push(c);
    return map;
  }, []);

  const toggle = (ruolo: string, codice_card: string) => {
    if (ruolo === "presidente") return;
    set_matrix((prev) => ({
      ...prev,
      [ruolo]: { ...prev[ruolo], [codice_card]: !prev[ruolo]?.[codice_card] },
    }));
  };

  const salva = async () => {
    if (!club_id) return;
    set_saving(true);
    try {
      const rows: any[] = [];
      for (const r of RUOLI_DASHBOARD) {
        if (r.codice === "presidente") continue;
        for (const c of CARDS) {
          rows.push({
            club_id,
            ruolo: r.codice,
            codice_card: c.codice,
            visibile: matrix[r.codice]?.[c.codice] ?? true,
          });
        }
      }
      const { error } = await supabase
        .from("dashboard_card_permessi")
        .upsert(rows, { onConflict: "club_id,ruolo,codice_card" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["dashboard_card_permessi_admin"] });
      toast({ title: "Permessi card salvati", description: "Si applicheranno al prossimo login degli utenti." });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const ripristina = async () => {
    if (!club_id) return;
    if (!window.confirm("Ripristinare la configurazione consigliata? Le impostazioni attuali verranno sovrascritte.")) return;
    set_saving(true);
    try {
      await supabase.from("dashboard_card_permessi").delete().eq("club_id", club_id);
      const rows: any[] = [];
      const m: Record<string, Record<string, boolean>> = {};
      for (const r of RUOLI_DASHBOARD) {
        m[r.codice] = {};
        const def = DEFAULTS[r.codice as RuoloKey] ?? [];
        for (const c of CARDS) {
          const visibile = r.codice === "presidente" ? true : def.includes(c.codice);
          m[r.codice][c.codice] = visibile;
          if (r.codice !== "presidente") {
            rows.push({ club_id, ruolo: r.codice, codice_card: c.codice, visibile });
          }
        }
      }
      const { error } = await supabase
        .from("dashboard_card_permessi")
        .upsert(rows, { onConflict: "club_id,ruolo,codice_card" });
      if (error) throw error;
      set_matrix(m);
      qc.invalidateQueries({ queryKey: ["dashboard_card_permessi_admin"] });
      toast({ title: "Configurazione consigliata applicata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Card visibili in Dashboard per ruolo</h2>
            <p className="text-xs text-muted-foreground">
              Per ogni ruolo, scegli quali card sono visibili nella dashboard. Il Presidente vede sempre tutto.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={ripristina} disabled={saving} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Ripristina configurazione consigliata
          </Button>
          <Button size="sm" onClick={salva} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvo..." : "Salva permessi card"}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide w-[42%]">Card</th>
                {RUOLI_DASHBOARD.map((r) => (
                  <th key={r.codice} className="text-center px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {r.label}
                    {r.codice === "presidente" && (
                      <div className="text-[10px] font-normal normal-case text-muted-foreground/70 mt-0.5">vede tutto</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREE.map((area) => {
                const area_cards = cards_per_area.get(area.codice) ?? [];
                return (
                  <React.Fragment key={area.codice}>
                    <tr className={`border-b ${AREA_HEADER_BG[area.codice]}`}>
                      <td colSpan={1 + RUOLI_DASHBOARD.length} className="px-4 py-2 text-xs font-bold uppercase tracking-wide">
                        {area.label}
                      </td>
                    </tr>
                    {area_cards.map((c, idx) => (
                      <tr key={c.codice} className={`border-b border-border/50 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium text-foreground">{c.titolo}</div>
                          <div className="text-xs text-muted-foreground">{c.descrizione}</div>
                        </td>
                        {RUOLI_DASHBOARD.map((r) => {
                          const checked = matrix[r.codice]?.[c.codice] ?? false;
                          const disabled = r.codice === "presidente";
                          return (
                            <td key={r.codice} className="px-3 py-2.5 text-center">
                              <div className="inline-flex">
                                <Switch
                                  checked={checked}
                                  onCheckedChange={() => toggle(r.codice, c.codice)}
                                  disabled={disabled}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-600">
          Il Presidente vede sempre tutte le card disponibili. Le modifiche si applicano al prossimo login degli utenti.
        </p>
      </div>
    </div>
  );
};

export default DashboardCardsPermessi;
