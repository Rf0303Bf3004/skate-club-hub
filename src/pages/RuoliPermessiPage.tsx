import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Shield, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

const RUOLI = ["segreteria", "direttore_tecnico", "istruttore"];
const RUOLI_LABEL: Record<string, string> = {
  segreteria: "Segreteria",
  direttore_tecnico: "Direttore Tecnico",
  istruttore: "Istruttore",
};
const SEZIONI = [
  { key: "atleti", label: "Atleti" },
  { key: "istruttori", label: "Istruttori" },
  { key: "corsi", label: "Corsi" },
  { key: "gare", label: "Gare" },
  { key: "lezioni_private", label: "Lezioni Private" },
  { key: "fatture", label: "Fatture" },
  { key: "comunicazioni", label: "Comunicazioni" },
  { key: "stagioni", label: "Stagioni" },
  { key: "campi", label: "Campi Allenamento" },
  { key: "setup_club", label: "Configurazione Club" },
];

const RuoliPermessiPage: React.FC = () => {
  const { session } = useAuth();
  const qc = useQueryClient();
  const club_id = session?.club_id;
  const [saving, set_saving] = useState(false);
  const [matrix, set_matrix] = useState<Record<string, Record<string, boolean>>>({});

  const { isLoading } = useQuery({
    queryKey: ["ruoli_permessi_admin", club_id],
    queryFn: async () => {
      if (!club_id) return [];
      const { data, error } = await supabase.from("ruoli_permessi").select("*").eq("club_id", club_id);
      if (error) throw error;
      const m: Record<string, Record<string, boolean>> = {};
      for (const ruolo of RUOLI) {
        m[ruolo] = {};
        for (const sezione of SEZIONI) {
          const p = (data ?? []).find((x: any) => x.ruolo === ruolo && x.sezione === sezione.key);
          m[ruolo][sezione.key] = p ? p.abilitato : false;
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
      for (const ruolo of RUOLI) {
        for (const sezione of SEZIONI) {
          const abilitato = matrix[ruolo]?.[sezione.key] ?? false;
          await supabase.from("ruoli_permessi").upsert({ club_id, ruolo, sezione: sezione.key, abilitato }, { onConflict: "club_id,ruolo,sezione" });
        }
      }
      qc.invalidateQueries({ queryKey: ["ruoli_permessi"] });
      toast({ title: "Permessi salvati!" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Gestione Ruoli e Permessi</h1>
            <p className="text-sm text-muted-foreground">Configura cosa può vedere ogni ruolo nella dashboard</p>
          </div>
        </div>
        <Button onClick={salva} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvo..." : "Salva permessi"}
        </Button>
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide w-48">Sezione</th>
              {RUOLI.map((ruolo) => (
                <th key={ruolo} className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">{RUOLI_LABEL[ruolo]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEZIONI.map((sezione, idx) => (
              <tr key={sezione.key} className={`border-b border-border/50 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                <td className="px-4 py-3 text-sm font-medium text-foreground">{sezione.label}</td>
                {RUOLI.map((ruolo) => (
                  <td key={ruolo} className="px-4 py-3 text-center">
                    <input type="checkbox" checked={matrix[ruolo]?.[sezione.key] ?? false} onChange={() => toggle(ruolo, sezione.key)} className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer accent-primary" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700 font-medium">Nota</p>
        <p className="text-xs text-blue-600 mt-1">L'admin vede sempre tutto. La Dashboard e visibile per tutti. Le modifiche si applicano al prossimo login degli utenti.</p>
      </div>
    </div>
  );
};

export default RuoliPermessiPage;
