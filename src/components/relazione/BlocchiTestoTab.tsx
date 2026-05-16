import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Newspaper, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import BloccoCard from "./BloccoCard";
import BloccoForm from "./BloccoForm";
import SortableItem from "./SortableItem";
import TabHeaderInfo from "./TabHeaderInfo";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

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
    mutationFn: async (ordered_ids: string[]) => {
      const ordini_correnti = (blocchi as any[])
        .filter((b) => ordered_ids.includes(b.id))
        .map((b) => b.ordine ?? 0)
        .sort((a, b) => a - b);
      await Promise.all(ordered_ids.map(async (id, index) => {
        const { error } = await supabase
          .from("relazioni_blocchi_testo" as any)
          .update({ ordine: ordini_correnti[index] ?? index * 10 })
          .eq("id", id);
        if (error) throw error;
      }));
    },
    onMutate: async (ordered_ids) => {
      const query_keys = [
        ["relazioni_blocchi", club_id, stagione_id],
        ["relazione_comp_blocchi", club_id, stagione_id],
      ];
      await Promise.all(query_keys.map((queryKey) => qc.cancelQueries({ queryKey })));
      const previous = query_keys.map((queryKey) => ({ queryKey, data: qc.getQueryData(queryKey) }));
      const ordini_correnti = (blocchi as any[])
        .filter((b) => ordered_ids.includes(b.id))
        .map((b) => b.ordine ?? 0)
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
      qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const on_drag_end = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = (blocchi as any[]).map((b) => b.id);
    const o = ids.indexOf(String(active.id));
    const n = ids.indexOf(String(over.id));
    if (o < 0 || n < 0) return;
    const next = [...ids];
    const [m] = next.splice(o, 1);
    next.splice(n, 0, m);
    m_reorder.mutate(next);
  };

  const max_ordine = (blocchi as any[]).reduce((m, b) => Math.max(m, b.ordine ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { set_editing(null); set_open_form(true); }} className="gap-2">
          <Plus className="w-4 h-4" />Nuovo blocco
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!isLoading && (blocchi as any[]).length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
          Nessun blocco. Aggiungi il primo blocco redazionale.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={on_drag_end}>
        <SortableContext items={(blocchi as any[]).map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {(blocchi as any[]).map((b) => (
              <SortableItem key={b.id} id={b.id}>
                <BloccoCard
                  blocco={b}
                  on_toggle={(attivo) => m_toggle.mutate({ id: b.id, attivo })}
                  on_edit={() => { set_editing(b); set_open_form(true); }}
                  on_delete={() => m_delete.mutate(b.id)}
                />
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
