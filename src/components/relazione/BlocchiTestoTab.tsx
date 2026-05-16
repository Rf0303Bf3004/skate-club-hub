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
  const [open_migration, set_open_migration] = useState(false);
  const [migrating, set_migrating] = useState(false);

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

  const blocchi_legacy = (blocchi as any[]).filter(
    (b) => b.categoria === "apertura" || b.categoria === "conclusioni",
  );

  useEffect(() => {
    if (blocchi_legacy.length > 0 && !migrating) set_open_migration(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocchi_legacy.length]);

  const run_migration = async (azione: "sposta" | "elimina") => {
    set_migrating(true);
    try {
      if (azione === "sposta") {
        const { error } = await supabase
          .from("relazioni_blocchi_testo" as any)
          .update({ categoria: "altro" })
          .eq("club_id", club_id)
          .in("categoria", ["apertura", "conclusioni"]);
        if (error) throw error;
        toast.success(`${blocchi_legacy.length} blocchi spostati nella categoria "Altro"`);
      } else {
        const { error } = await supabase
          .from("relazioni_blocchi_testo" as any)
          .delete()
          .eq("club_id", club_id)
          .in("categoria", ["apertura", "conclusioni"]);
        if (error) throw error;
        toast.success(`${blocchi_legacy.length} blocchi eliminati`);
      }
      await qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] });
      await qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] });
      set_open_migration(false);
    } catch (e: any) {
      toast.error(e.message ?? "Errore durante la migrazione");
    } finally {
      set_migrating(false);
    }
  };

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
      <TabHeaderInfo
        icon={Newspaper}
        titolo="Notizie e messaggi del Presidente"
        testo="Qui scrivi le notizie e i messaggi che NON si trovano nei dati della dashboard: cambi di staff, trattative in corso, progetti futuri, decisioni del consiglio. Queste pagine vengono inserite nel PDF come capitoli redazionali separati, dopo le sezioni dati."
        collapsible_label="Quando usare cosa? Vedi esempi"
      >
        <div className="overflow-x-auto rounded-md border border-teal-200 bg-white/60">
          <table className="w-full text-sm">
            <thead className="bg-teal-50 text-teal-900">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Esempio</th>
                <th className="text-left px-3 py-2 font-medium">Dove va</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100">
              <tr>
                <td className="px-3 py-2">"Barbara Sella lascia il club"</td>
                <td className="px-3 py-2 text-teal-800">Notizie (categoria <em>Staff</em>)</td>
              </tr>
              <tr>
                <td className="px-3 py-2">"Stiamo trattando con la pista per +2h"</td>
                <td className="px-3 py-2 text-teal-800">Notizie (categoria <em>Trattative</em>)</td>
              </tr>
              <tr>
                <td className="px-3 py-2">"Vogliamo lanciare un Gala a Settembre 2026"</td>
                <td className="px-3 py-2 text-teal-800">Notizie (categoria <em>Eventi futuri</em>)</td>
              </tr>
              <tr>
                <td className="px-3 py-2">"Quest'anno abbiamo 145 atleti"</td>
                <td className="px-3 py-2 text-muted-foreground">NO: gia' nel Racconto dei dati area <em>Atleti</em></td>
              </tr>
              <tr>
                <td className="px-3 py-2">"I ricavi crescono dell'11%"</td>
                <td className="px-3 py-2 text-muted-foreground">NO: gia' nel Racconto dei dati area <em>Economia</em></td>
              </tr>
            </tbody>
          </table>
        </div>
      </TabHeaderInfo>

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

      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground flex items-start gap-2">
        <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          Cerchi il messaggio di apertura o di chiusura? Quelli si modificano nel <strong>Racconto dei dati</strong>:{" "}
          <Link
            to="/presidente/relazione/contenuti?tab=paragrafi"
            className="text-teal-700 hover:text-teal-900 underline font-medium"
          >
            vai alla tab e cerca area "Apertura" o "Chiusura"
          </Link>.
        </div>
      </div>

      <BloccoForm
        open={open_form}
        on_close={() => set_open_form(false)}
        club_id={club_id}
        stagione_id={stagione_id}
        blocco={editing}
        default_ordine={max_ordine + 10}
      />

      <AlertDialog open={open_migration} onOpenChange={set_open_migration}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Riorganizzazione delle notizie</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Abbiamo riorganizzato la struttura delle notizie. {blocchi_legacy.length === 1 ? "Il blocco" : `${blocchi_legacy.length} blocchi`}{" "}
                  con categoria <strong>Apertura</strong> o <strong>Conclusioni</strong> ora{" "}
                  {blocchi_legacy.length === 1 ? "e' gestito automaticamente" : "sono gestiti automaticamente"} nel{" "}
                  <strong>Racconto dei dati</strong> (aree "Apertura" e "Chiusura").
                </p>
                {blocchi_legacy.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {blocchi_legacy.slice(0, 5).map((b) => (
                      <li key={b.id}>
                        <span className="font-medium text-foreground">{b.titolo}</span>{" "}
                        <em>({b.categoria})</em>
                      </li>
                    ))}
                  </ul>
                )}
                <p>Cosa vuoi fare?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" disabled={migrating} onClick={() => set_open_migration(false)}>
              Decido dopo
            </Button>
            <Button variant="outline" disabled={migrating} onClick={() => run_migration("elimina")}>
              Elimina
            </Button>
            <Button disabled={migrating} onClick={() => run_migration("sposta")}>
              Sposta in "Altro"
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
