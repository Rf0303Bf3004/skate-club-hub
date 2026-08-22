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
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface Props { club_id: string; stagione_id: string; }

const tk = (key: string, opts?: any) => i18n.t(`relazione.blocchi_tab.${key}`, { ns: "dashboard", ...(opts ?? {}) }) as string;

export default function BlocchiTestoTab({ club_id, stagione_id }: Props) {
  const { t } = useTranslation("dashboard");
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
        toast.success(tk("toast_spostati", { count: blocchi_legacy.length }));
      } else {
        const { error } = await supabase
          .from("relazioni_blocchi_testo" as any)
          .delete()
          .eq("club_id", club_id)
          .in("categoria", ["apertura", "conclusioni"]);
        if (error) throw error;
        toast.success(tk("toast_eliminati", { count: blocchi_legacy.length }));
      }
      await qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] });
      await qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] });
      set_open_migration(false);
    } catch (e: any) {
      toast.error(e.message ?? tk("toast_migrazione_ko"));
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
      toast.success(tk("toast_blocco_eliminato"));
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
      toast.error(tk("toast_riordino_ko"));
    },
    onSuccess: () => toast.success(tk("toast_ordine_ok")),
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
        titolo={t("relazione.blocchi_tab.header_titolo")}
        testo={t("relazione.blocchi_tab.header_testo")}
        collapsible_label={t("relazione.blocchi_tab.header_esempi_label")}
      >
        <div className="overflow-x-auto rounded-md border border-teal-200 bg-white/60">
          <table className="w-full text-sm">
            <thead className="bg-teal-50 text-teal-900">
              <tr>
                <th className="text-left px-3 py-2 font-medium">{t("relazione.blocchi_tab.tabella_esempio")}</th>
                <th className="text-left px-3 py-2 font-medium">{t("relazione.blocchi_tab.tabella_dove")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100">
              <tr>
                <td className="px-3 py-2">{t("relazione.blocchi_tab.esempio_1")}</td>
                <td className="px-3 py-2 text-teal-800">{t("relazione.blocchi_tab.esempio_1_dove")}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">{t("relazione.blocchi_tab.esempio_2")}</td>
                <td className="px-3 py-2 text-teal-800">{t("relazione.blocchi_tab.esempio_2_dove")}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">{t("relazione.blocchi_tab.esempio_3")}</td>
                <td className="px-3 py-2 text-teal-800">{t("relazione.blocchi_tab.esempio_3_dove")}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">{t("relazione.blocchi_tab.esempio_4")}</td>
                <td className="px-3 py-2 text-muted-foreground">{t("relazione.blocchi_tab.esempio_4_dove")}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">{t("relazione.blocchi_tab.esempio_5")}</td>
                <td className="px-3 py-2 text-muted-foreground">{t("relazione.blocchi_tab.esempio_5_dove")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </TabHeaderInfo>

      <div className="flex justify-end">
        <Button onClick={() => { set_editing(null); set_open_form(true); }} className="gap-2">
          <Plus className="w-4 h-4" />{t("relazione.blocchi_tab.nuovo")}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t("relazione.blocchi_tab.caricamento")}</p>}
      {!isLoading && (blocchi as any[]).length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
          {t("relazione.blocchi_tab.empty")}
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
          {t("relazione.blocchi_tab.rimando_testo")}{" "}
          <Link
            to="/presidente/relazione/contenuti?tab=paragrafi"
            className="text-teal-700 hover:text-teal-900 underline font-medium"
          >
            {t("relazione.blocchi_tab.rimando_link")}
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
            <AlertDialogTitle>{t("relazione.blocchi_tab.migrazione_title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>{t("relazione.blocchi_tab.migrazione_desc", { count: blocchi_legacy.length })}</p>
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
                <p>{t("relazione.blocchi_tab.migrazione_domanda")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" disabled={migrating} onClick={() => set_open_migration(false)}>
              {t("relazione.blocchi_tab.decido_dopo")}
            </Button>
            <Button variant="outline" disabled={migrating} onClick={() => run_migration("elimina")}>
              {t("relazione.blocchi_tab.elimina")}
            </Button>
            <Button disabled={migrating} onClick={() => run_migration("sposta")}>
              {t("relazione.blocchi_tab.sposta_altro")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
