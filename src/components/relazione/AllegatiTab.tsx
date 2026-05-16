import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import AllegatoCard from "./AllegatoCard";
import AllegatoForm from "./AllegatoForm";

interface Props { club_id: string; stagione_id: string; }

export default function AllegatiTab({ club_id, stagione_id }: Props) {
  const qc = useQueryClient();
  const [editing, set_editing] = useState<any | null>(null);
  const [open_form, set_open_form] = useState(false);

  const { data: allegati = [], isLoading } = useQuery({
    queryKey: ["relazioni_allegati", club_id, stagione_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_allegati" as any)
        .select("*")
        .eq("club_id", club_id)
        .or(`stagione_id.eq.${stagione_id},stagione_id.is.null`)
        .order("ordine");
      if (error) throw error;
      return data ?? [];
    },
  });

  const m_delete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("relazioni_allegati" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] });
      toast.success("Allegato eliminato");
    },
  });

  const m_reorder = useMutation({
    mutationFn: async ({ id, ordine }: { id: string; ordine: number }) => {
      const { error } = await supabase.from("relazioni_allegati" as any).update({ ordine }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] }),
  });

  const handle_new = () => { set_editing(null); set_open_form(true); };
  const handle_edit = (a: any) => { set_editing(a); set_open_form(true); };
  const move = (a: any, dir: -1 | 1) => m_reorder.mutate({ id: a.id, ordine: (a.ordine ?? 0) + dir * 5 });
  const max_ordine = (allegati as any[]).reduce((m, a) => Math.max(m, a.ordine ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handle_new} className="gap-2"><Plus className="w-4 h-4" />Carica nuovo allegato</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!isLoading && (allegati as any[]).length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
          Nessun allegato. Carica il primo documento PDF.
        </p>
      )}

      <div className="space-y-3">
        {(allegati as any[]).map((a) => (
          <AllegatoCard
            key={a.id}
            allegato={a}
            on_edit={() => handle_edit(a)}
            on_delete={() => m_delete.mutate(a.id)}
            on_up={() => move(a, -1)}
            on_down={() => move(a, 1)}
          />
        ))}
      </div>

      <AllegatoForm
        open={open_form}
        on_close={() => set_open_form(false)}
        club_id={club_id}
        stagione_id={stagione_id}
        allegato={editing}
        default_ordine={max_ordine + 10}
      />
    </div>
  );
}
