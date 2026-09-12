import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Tag } from "lucide-react";
import { TEST_BASE_PASSAGGI, TEST_CARRIERA_PASSAGGI } from "@/lib/atleta-livello";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import { segnala_errore } from "@/lib/errori";

/** I dieci tipi di test, in ordine di progressione (base poi carriera). */
export const LIVELLI_TARIFFA: string[] = [
  ...TEST_BASE_PASSAGGI.map((p) => p.target),
  ...TEST_CARRIERA_PASSAGGI.map((p) => p.target),
];

type TariffaRow = {
  id: string;
  livello_target: string;
  prezzo: number | null;
  attiva: boolean | null;
};

type Riga = { prezzo: string; attiva: boolean };

export function use_tariffe_test() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["tariffe_test_livello", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffe_test_livello")
        .select("id, livello_target, prezzo, attiva")
        .eq("club_id", club_id as string);
      if (error) throw error;
      return (data ?? []) as TariffaRow[];
    },
  });
}

const TariffeTestSection: React.FC = () => {
  const qc = useQueryClient();
  const { puo_gestire_fatture } = usePermessiAzione();
  const { data: tariffe = [] } = use_tariffe_test();
  const [righe, set_righe] = useState<Record<string, Riga>>({});
  const [saving, set_saving] = useState(false);

  useEffect(() => {
    const next: Record<string, Riga> = {};
    for (const liv of LIVELLI_TARIFFA) {
      const r = tariffe.find((x) => x.livello_target === liv);
      next[liv] = {
        prezzo: r?.prezzo != null ? String(r.prezzo) : "",
        attiva: r ? r.attiva !== false : true,
      };
    }
    set_righe(next);
  }, [tariffe]);

  const set_campo = (liv: string, patch: Partial<Riga>) =>
    set_righe((s) => ({ ...s, [liv]: { ...(s[liv] ?? { prezzo: "", attiva: true }), ...patch } }));

  const salva = async () => {
    const club_id = get_current_club_id();
    if (!club_id) return;
    set_saving(true);
    try {
      const da_salvare = LIVELLI_TARIFFA.filter((l) => (righe[l]?.prezzo ?? "").trim() !== "");
      const da_togliere = LIVELLI_TARIFFA.filter(
        (l) => (righe[l]?.prezzo ?? "").trim() === "" && tariffe.some((t) => t.livello_target === l),
      );

      if (da_salvare.length > 0) {
        const payload = da_salvare.map((l) => ({
          club_id,
          livello_target: l,
          prezzo: Number(righe[l].prezzo) || 0,
          attiva: righe[l].attiva,
        }));
        const { error } = await supabase
          .from("tariffe_test_livello")
          .upsert(payload, { onConflict: "club_id,livello_target" });
        if (error) throw error;
      }
      if (da_togliere.length > 0) {
        const { error } = await supabase
          .from("tariffe_test_livello")
          .delete()
          .eq("club_id", club_id)
          .in("livello_target", da_togliere);
        if (error) throw error;
      }

      await qc.invalidateQueries({ queryKey: ["tariffe_test_livello", club_id] });
      toast({ title: "Tariffe dei test salvate" });
    } catch (err) {
      segnala_errore("TariffeTestSection", "Salvataggio tariffe dei test", err);
    } finally {
      set_saving(false);
    }
  };

  const attive_count = useMemo(
    () => LIVELLI_TARIFFA.filter((l) => (righe[l]?.prezzo ?? "").trim() !== "" && righe[l]?.attiva).length,
    [righe],
  );

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Tag className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Tariffe dei test</h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Se lasci vuoto un tipo di test, si usa il prezzo scritto sulla singola giornata di test.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LIVELLI_TARIFFA.map((liv) => {
          const r = righe[liv] ?? { prezzo: "", attiva: true };
          return (
            <div key={liv} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Label className="flex-1 text-sm font-medium">{liv}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-28"
                placeholder="CHF"
                value={r.prezzo}
                disabled={!puo_gestire_fatture}
                onChange={(e) => set_campo(liv, { prezzo: e.target.value })}
              />
              <Switch
                checked={r.attiva}
                disabled={!puo_gestire_fatture}
                onCheckedChange={(v) => set_campo(liv, { attiva: v })}
                aria-label={`Tariffa attiva per ${liv}`}
              />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {attive_count === 0
          ? "Nessuna tariffa attiva: vale il prezzo della singola giornata."
          : `${attive_count} tipi di test hanno una tariffa attiva nel listino.`}
      </p>

      {puo_gestire_fatture ? (
        <Button onClick={salva} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Salva le tariffe
        </Button>
      ) : (
        <NotaPermesso testo="Solo la segreteria e il presidente possono modificare le tariffe." />
      )}
    </div>
  );
};

export default TariffeTestSection;
