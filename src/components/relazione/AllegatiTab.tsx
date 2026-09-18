import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Upload, AlertTriangle } from "lucide-react";
import TabHeaderInfo from "./TabHeaderInfo";
import { toast } from "sonner";
import AllegatoCard from "./AllegatoCard";
import AllegatoForm from "./AllegatoForm";
import SortableItem from "./SortableItem";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface Props { club_id: string; stagione_id: string; compatto?: boolean; }

const tk = (key: string, opts?: any) => i18n.t(`relazione.allegati_tab.${key}`, { ns: "dashboard", ...(opts ?? {}) }) as string;

export default function AllegatiTab({ club_id, stagione_id, compatto = false }: Props) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const [editing, set_editing] = useState<any | null>(null);
  const [open_form, set_open_form] = useState(false);
  const file_input_ref = useRef<HTMLInputElement | null>(null);

  const q_allegati = useQuery({
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
  const allegati = q_allegati.data ?? [];

  const m_delete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("relazioni_allegati" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] });
      toast.success(tk("toast_eliminato"));
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
      toast.error(tk("toast_riordino_ko"));
    },
    onSuccess: () => toast.success(tk("toast_ordine_ok")),
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

  const m_carica = useMutation({
    mutationFn: async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error(t("relazione.allegati_tab.solo_pdf"));
      if (file.size > 20 * 1024 * 1024) throw new Error(t("relazione.allegato_form.errore_dimensione"));
      const path = `${club_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upload_error } = await supabase.storage.from("relazioni-allegati").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upload_error) throw upload_error;
      const { error } = await supabase.from("relazioni_allegati" as any).insert({ club_id, stagione_id, categoria: "altro", titolo: file.name.replace(/\.pdf$/i, ""), ordine: max_ordine + 10, file_url: path, file_size_bytes: file.size, mime_type: "application/pdf" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] }),
    onError: (e: any) => toast.error(e?.message ?? t("relazione.allegato_form.toast_errore")),
  });

  return (
    <div className="space-y-4">
      {!compatto && <TabHeaderInfo
        icon={FileText}
        titolo={t("relazione.allegati_tab.header_titolo")}
        testo={t("relazione.allegati_tab.header_testo")}
      />}
      {!compatto && <div className="flex justify-end">
        <Button onClick={() => { set_editing(null); set_open_form(true); }} className="gap-2">
          <Plus className="w-4 h-4" />{t("relazione.allegati_tab.nuovo")}
        </Button>
      </div>}

      {compatto && <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) m_carica.mutate(file); }} onClick={() => file_input_ref.current?.click()} className="cursor-pointer border border-dashed p-8 text-center text-muted-foreground"><input ref={file_input_ref} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) m_carica.mutate(file); e.target.value = ""; }} /><Upload className="mx-auto mb-3 h-6 w-6" /><p className="font-medium text-foreground">{t("relazione.allegati_tab.zona_titolo")}</p><p className="mt-1 text-xs">{t("relazione.allegati_tab.zona_testo")}</p></div>}

      {q_allegati.isPending && <p className="text-sm text-muted-foreground">{t("relazione.allegati_tab.caricamento")}</p>}
      {q_allegati.isError && <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{t("relazione.allegati_tab.errore_lettura")}<Button size="sm" variant="outline" onClick={() => q_allegati.refetch()}>{t("relazione.riprova")}</Button></div>}
      {q_allegati.isSuccess && !compatto && (allegati as any[]).length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
          {t("relazione.allegati_tab.empty")}
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
