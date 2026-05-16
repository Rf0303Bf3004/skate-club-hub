import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import TabHeaderInfo from "./TabHeaderInfo";
import { toast } from "sonner";
import AllegatoCard from "./AllegatoCard";
import AllegatoForm from "./AllegatoForm";
import SortableItem from "./SortableItem";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

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
    mutationFn: async (ordered_ids: string[]) => {
      const ordini_correnti = (allegati as any[])
        .filter((a) => ordered_ids.includes(a.id))
        .map((a) => a.ordine ?? 0)
        .sort((a, b) => a - b);
      await Promise.all(ordered_ids.map(async (id, index) => {
        const { error } = await supabase
          .from("relazioni_allegati" as any)
          .update({ ordine: ordini_correnti[index] ?? index * 10 })
          .eq("id", id);
        if (error) throw error;
      }));
    },
    onMutate: async (ordered_ids) => {
      const query_keys = [
        ["relazioni_allegati", club_id, stagione_id],
        ["relazione_comp_allegati", club_id, stagione_id],
      ];
      await Promise.all(query_keys.map((queryKey) => qc.cancelQueries({ queryKey })));
      const previous = query_keys.map((queryKey) => ({ queryKey, data: qc.getQueryData(queryKey) }));
      const ordini_correnti = (allegati as any[])
        .filter((a) => ordered_ids.includes(a.id))
        .map((a) => a.ordine ?? 0)
        .sort((a, b) => a - b);
      const ordine_by_id = new Map(ordered_ids.map((id, index) => [id, ordini_correnti[index] ?? index * 10]));
      const update_rows = (old: any[] | undefined) => old
        ? [...old.map((row) => ordine_by_id.has(row.id) ? { ...row, ordine: ordine_by_id.get(row.id) } : row)]
          .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0))
        : old;
      query_keys.forEach((queryKey) => qc.setQueryData(queryKey, update_rows));
      return { previous };
    },
    onError: (_error, _ids, context) => {
      context?.previous.forEach(({ queryKey, data }) => qc.setQueryData(queryKey, data));
      toast.error("Riordino non salvato");
    },
    onSuccess: () => toast.success("Ordine salvato"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_allegati", club_id, stagione_id] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const on_drag_end = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = (allegati as any[]).map((a) => a.id);
    const o = ids.indexOf(String(active.id));
    const n = ids.indexOf(String(over.id));
    if (o < 0 || n < 0) return;
    const next = [...ids];
    const [m] = next.splice(o, 1);
    next.splice(n, 0, m);
    m_reorder.mutate(next);
  };

  const max_ordine = (allegati as any[]).reduce((m, a) => Math.max(m, a.ordine ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { set_editing(null); set_open_form(true); }} className="gap-2">
          <Plus className="w-4 h-4" />Carica nuovo allegato
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!isLoading && (allegati as any[]).length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
          Nessun allegato. Carica il primo documento PDF.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={on_drag_end}>
        <SortableContext items={(allegati as any[]).map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {(allegati as any[]).map((a) => (
              <SortableItem key={a.id} id={a.id}>
                <AllegatoCard
                  allegato={a}
                  on_edit={() => { set_editing(a); set_open_form(true); }}
                  on_delete={() => m_delete.mutate(a.id)}
                />
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
