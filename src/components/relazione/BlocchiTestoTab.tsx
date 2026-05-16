import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import BloccoCard from "./BloccoCard";
import BloccoForm from "./BloccoForm";

interface Props { club_id: string; stagione_id: string; }

export default function BlocchiTestoTab({ club_id, stagione_id }: Props) {
  const qc = useQueryClient();
  const [editing, set_editing] = useState<any | null>(null);
  const [open_form, set_open_form] = useState(false);

  const { data: blocchi = [], isLoading } = useQuery({
    queryKey: ["relazioni_blocchi", club_id, stagione_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_blocchi_testo" as any)
        .select("*")
        .eq("club_id", club_id)
        .or(`stagione_id.eq.${stagione_id},stagione_id.is.null`)
        .order("categoria")
        .order("ordine");
      if (error) throw error;
      return data ?? [];
    },
  });

  const m_toggle = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("relazioni_blocchi_testo" as any).update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] }),
  });

  const m_delete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("relazioni_blocchi_testo" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] });
      toast.success("Blocco eliminato");
    },
  });

  const m_reorder = useMutation({
    mutationFn: async ({ id, ordine }: { id: string; ordine: number }) => {
      const { error } = await supabase.from("relazioni_blocchi_testo" as any).update({ ordine }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] }),
  });

  const move = (b: any, dir: -1 | 1) => {
    m_reorder.mutate({ id: b.id, ordine: (b.ordine ?? 0) + dir * 5 });
  };

  const handle_new = () => {
    set_editing(null);
    set_open_form(true);
  };

  const handle_edit = (b: any) => {
    set_editing(b);
    set_open_form(true);
  };

  const max_ordine = (blocchi as any[]).reduce((m, b) => Math.max(m, b.ordine ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handle_new} className="gap-2"><Plus className="w-4 h-4" />Nuovo blocco</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!isLoading && (blocchi as any[]).length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
          Nessun blocco. Aggiungi il primo blocco redazionale.
        </p>
      )}

      <div className="space-y-3">
        {(blocchi as any[]).map((b) => (
          <BloccoCard
            key={b.id}
            blocco={b}
            on_toggle={(attivo) => m_toggle.mutate({ id: b.id, attivo })}
            on_edit={() => handle_edit(b)}
            on_delete={() => m_delete.mutate(b.id)}
            on_up={() => move(b, -1)}
            on_down={() => move(b, 1)}
          />
        ))}
      </div>

      <BloccoForm
        open={open_form}
        on_close={() => set_open_form(false)}
        club_id={club_id}
        stagione_id={stagione_id}
        blocco={editing}
        default_ordine={max_ordine + 10}
      />
    </div>
  );
}
