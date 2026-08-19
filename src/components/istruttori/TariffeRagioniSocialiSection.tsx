import React from "react";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import {
  use_ragioni_sociali,
  use_tariffe_istruttore,
  use_upsert_tariffa_istruttore,
} from "@/hooks/use-ragioni-sociali";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";

/**
 * Tariffe orarie dell'istruttore differenziate per ragione sociale pagante.
 * Visibile SOLO se l'area "fatturazione" è in modalità "multi_ragione_sociale".
 */
export const TariffeRagioniSocialiSection: React.FC<{ istruttore_id: string }> = ({ istruttore_id }) => {
  const { modalita } = useModalitaArea("fatturazione");
  const { data: ragioni = [] } = use_ragioni_sociali();
  const { data: tariffe = [] } = use_tariffe_istruttore(istruttore_id);
  const upsert = use_upsert_tariffa_istruttore();
  const [valori, set_valori] = React.useState<Record<string, string>>({});
  const [saving_id, set_saving_id] = React.useState<string | null>(null);

  React.useEffect(() => {
    const next: Record<string, string> = {};
    tariffe.forEach((t) => {
      next[t.ragione_sociale_id] = t.tariffa_oraria_chf == null ? "" : String(t.tariffa_oraria_chf);
    });
    set_valori(next);
  }, [tariffe]);

  if (modalita !== "multi_ragione_sociale" || ragioni.length === 0) return null;

  const salva = async (ragione_sociale_id: string) => {
    set_saving_id(ragione_sociale_id);
    try {
      const raw = valori[ragione_sociale_id];
      await upsert.mutateAsync({
        istruttore_id,
        ragione_sociale_id,
        tariffa_oraria_chf: raw === undefined || raw === "" ? null : Number(raw),
      });
      toast({ title: "✅ Tariffa salvata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    } finally {
      set_saving_id(null);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Tariffe per ragione sociale
        </h2>
      </div>

      <div className="space-y-2">
        {ragioni.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg bg-muted/20 px-3 py-2">
            <span className="flex-1 truncate text-sm font-medium text-foreground">{r.nome}</span>
            <Input
              type="number"
              step="0.01"
              placeholder="Non definita"
              className="h-9 w-36"
              value={valori[r.id] ?? ""}
              onChange={(e) => set_valori((p) => ({ ...p, [r.id]: e.target.value }))}
            />
            <span className="text-xs text-muted-foreground">CHF/h</span>
            <Button size="sm" variant="outline" onClick={() => salva(r.id)} disabled={saving_id === r.id}>
              {saving_id === r.id ? "..." : "Salva"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TariffeRagioniSocialiSection;
