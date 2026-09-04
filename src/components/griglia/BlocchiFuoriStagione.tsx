import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_stagione_attiva } from "@/lib/stagione-attiva";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { CalendarX, Trash2 } from "lucide-react";

interface BloccoFuori {
  id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  titolo: string | null;
}

function data_it(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("it-CH");
}

/**
 * Se la stagione viene accorciata, i blocchi della Griglia già generati oltre
 * la nuova fine restano orfani: qui vengono elencati e si possono eliminare
 * in blocco, con conferma esplicita.
 */
const BlocchiFuoriStagione: React.FC<{ is_editor: boolean }> = ({ is_editor }) => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const { data: stagione } = use_stagione_attiva();

  const { data: blocchi = [] } = useQuery({
    queryKey: ["griglia_blocchi_fuori_stagione", club_id, stagione?.id],
    enabled: !!club_id && !!stagione,
    queryFn: async (): Promise<BloccoFuori[]> => {
      const { data, error } = await supabase
        .from("griglia_blocchi" as any)
        .select("id,data,ora_inizio,ora_fine,titolo")
        .eq("club_id", club_id)
        .or(`data.lt.${stagione!.data_inizio},data.gt.${stagione!.data_fine}`)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any as BloccoFuori[];
    },
  });

  if (!stagione || blocchi.length === 0) return null;

  const elimina = async () => {
    const { error } = await supabase
      .from("griglia_blocchi" as any)
      .delete()
      .in(
        "id",
        blocchi.map((b) => b.id),
      );
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${blocchi.length} blocchi fuori stagione eliminati` });
    qc.invalidateQueries({ queryKey: ["griglia_blocchi_fuori_stagione"] });
    qc.invalidateQueries({ queryKey: ["griglia_blocchi"] });
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarX className="w-4 h-4 text-amber-700 shrink-0" />
        <p className="text-sm text-amber-900 flex-1 min-w-0">
          {blocchi.length === 1 ? "1 giornata di griglia è" : `${blocchi.length} giornate di griglia sono`} fuori
          dalla stagione «{stagione.nome}» ({data_it(stagione.data_inizio)} – {data_it(stagione.data_fine)}).
        </p>
        {is_editor && (
          <ConfirmButton
            titolo={`Eliminare ${blocchi.length} giornate fuori stagione?`}
            descrizione="Verranno eliminati i blocchi e tutte le sotto-sessioni collegate. L'operazione non è reversibile."
            conferma_label="Elimina"
            on_conferma={elimina}
          >
            <Button size="sm" variant="outline">
              <Trash2 className="w-4 h-4 mr-1" /> Elimina
            </Button>
          </ConfirmButton>
        )}
      </div>
      <div className="max-h-32 overflow-auto text-xs text-amber-900 space-y-0.5">
        {blocchi.slice(0, 30).map((b) => (
          <div key={b.id}>
            {data_it(b.data)} · {(b.ora_inizio ?? "").slice(0, 5)}–{(b.ora_fine ?? "").slice(0, 5)}
            {b.titolo ? ` · ${b.titolo}` : ""}
          </div>
        ))}
        {blocchi.length > 30 && <div>…e altre {blocchi.length - 30}.</div>}
      </div>
    </div>
  );
};

export default BlocchiFuoriStagione;
