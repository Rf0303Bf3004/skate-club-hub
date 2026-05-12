import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Shield, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardCardsPermessi from "@/components/ruoli-permessi/DashboardCardsPermessi";
import { MENU_SECTIONS } from "@/config/menuSections";

const RUOLI = [
  { codice: "presidente", label: "Presidente", forced: true },
  { codice: "segreteria", label: "Segreteria", forced: false },
  { codice: "dt", label: "Direttore Tecnico", forced: false },
  { codice: "istruttore", label: "Istruttore", forced: false },
  { codice: "aiuto_monitore", label: "Aiuto Monitore", forced: false },
];

const RuoliPermessiPage: React.FC = () => {
  const { session } = useAuth();
  const qc = useQueryClient();
  const club_id = session?.club_id;
  const [saving, set_saving] = useState(false);
  const [matrix, set_matrix] = useState<Record<string, Record<string, boolean>>>({});

  const { isLoading } = useQuery({
    queryKey: ["ruoli_permessi_sezioni_admin", club_id],
    queryFn: async () => {
      if (!club_id) return [];
      const { data, error } = await supabase
        .from("ruoli_permessi_sezioni" as any)
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      const m: Record<string, Record<string, boolean>> = {};
      for (const r of RUOLI) {
        m[r.codice] = {};
        for (const s of MENU_SECTIONS) {
          if (r.forced) {
            m[r.codice][s.codice] = true;
          } else {
            const p = (data ?? []).find((x: any) => x.ruolo === r.codice && x.codice_sezione === s.codice);
            m[r.codice][s.codice] = p ? p.visibile : false;
          }
        }
      }
      set_matrix(m);
      return data ?? [];
    },
    enabled: !!club_id,
  });

  const toggle = (ruolo: string, sezione: string) => {
    set_matrix((prev) => ({ ...prev, [ruolo]: { ...prev[ruolo], [sezione]: !prev[ruolo]?.[sezione] } }));
  };

  const salva = async () => {
    if (!club_id) return;
    set_saving(true);
    try {
      const rows: any[] = [];
      for (const r of RUOLI) {
        for (const s of MENU_SECTIONS) {
          rows.push({
            club_id,
            ruolo: r.codice,
            codice_sezione: s.codice,
            visibile: r.forced ? true : (matrix[r.codice]?.[s.codice] ?? false),
          });
        }
      }
      const { error } = await supabase
        .from("ruoli_permessi_sezioni" as any)
        .upsert(rows, { onConflict: "club_id,ruolo,codice_sezione" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["ruoli_permessi_sezioni"] });
      toast({ title: "Permessi salvati", description: "Si applicheranno al prossimo login degli utenti." });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const gruppi = ["principale", "setup"] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Gestione Ruoli e Permessi</h1>
            <p className="text-sm text-muted-foreground">Configura cosa vede ogni ruolo nel menu di sinistra</p>
          </div>
        </div>
        <Button onClick={salva} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvo..." : "Salva permessi"}
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide w-56">Sezione</th>
              {RUOLI.map((r) => (
                <th key={r.codice} className="text-center px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  {r.label}
                  {r.forced && <div className="text-[9px] font-normal normal-case text-primary mt-0.5">vede tutto</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gruppi.map((gruppo) => (
              <React.Fragment key={gruppo}>
                <tr className="bg-muted/20 border-b border-border">
                  <td colSpan={1 + RUOLI.length} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {gruppo === "principale" ? "Menu principale" : "Setup"}
                  </td>
                </tr>
                {MENU_SECTIONS.filter((s) => s.gruppo === gruppo).map((sezione, idx) => (
                  <tr key={sezione.codice} className={`border-b border-border/50 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                    <td className="px-4 py-3 text-sm font-medium text-foreground flex items-center gap-2">
                      <sezione.icon className="w-4 h-4 text-muted-foreground" />
                      {sezione.label}
                    </td>
                    {RUOLI.map((r) => (
                      <td key={r.codice} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={matrix[r.codice]?.[sezione.codice] ?? false}
                          disabled={r.forced}
                          onChange={() => toggle(r.codice, sezione.codice)}
                          className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer accent-primary disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700 font-medium">Nota</p>
        <p className="text-xs text-blue-600 mt-1">L'admin e il superadmin vedono sempre tutto. Le modifiche si applicano al prossimo login degli utenti.</p>
      </div>

      <div className="pt-4 border-t border-border">
        <DashboardCardsPermessi />
      </div>
    </div>
  );
};

export default RuoliPermessiPage;
