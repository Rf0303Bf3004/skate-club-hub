import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatBytes } from "@/lib/utils";
import IndiceComponibile from "./IndiceComponibile";
import AnteprimaPDF from "./AnteprimaPDF";
import { CompositoreItem, SISTEMA_LABELS } from "./types-compositore";
import { AREA_DEFINITIONS } from "./MockSezionePDF";
import { cat_blocco, cat_allegato } from "./categorie";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, Save } from "lucide-react";
import { saveAs } from "file-saver";
import { generateRelazionePDF, buildRelazioneFilename } from "@/lib/pdfGenerator";
import { saving_store, useSavingState } from "@/stores/savingState";
import type { Tono } from "@/lib/paragraphGenerator";

interface Props {
  club_id: string;
  stagione_id: string;
  club: any;
  presidente: string;
  stagione_nome: string;
}

const DEFAULT_PREFS: Array<{ sezione_tipo: string; sezione_id: string; ordine: number }> = [
  { sezione_tipo: "sistema", sezione_id: "copertina", ordine: 0 },
  { sezione_tipo: "sistema", sezione_id: "indice", ordine: 5 },
  { sezione_tipo: "area_dashboard", sezione_id: "sintesi", ordine: 10 },
  { sezione_tipo: "area_dashboard", sezione_id: "domanda", ordine: 20 },
  { sezione_tipo: "area_dashboard", sezione_id: "atleti", ordine: 30 },
  { sezione_tipo: "area_dashboard", sezione_id: "economia", ordine: 40 },
  { sezione_tipo: "area_dashboard", sezione_id: "lezioni", ordine: 50 },
  { sezione_tipo: "area_dashboard", sezione_id: "sportivo", ordine: 60 },
  { sezione_tipo: "area_dashboard", sezione_id: "catalogo", ordine: 70 },
  { sezione_tipo: "sistema", sezione_id: "chiusura", ordine: 999 },
];

export default function Compositore({ club_id, stagione_id, club, presidente, stagione_nome }: Props) {
  const qc = useQueryClient();
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [generating, set_generating] = useState(false);
  const is_generating_ref = useRef(false);
  const saving = useSavingState();

  const handle_generate = async () => {
    if (is_generating_ref.current) {
      console.log("[PDF] Generazione gia in corso, click ignorato");
      return;
    }
    is_generating_ref.current = true;
    set_generating(true);
    try {
      console.log("[PDF] Generazione avviata");
      const attivi = items.filter((i) => i.attivo);
      const { blob, pages } = await generateRelazionePDF({
        club,
        presidente,
        stagione_nome,
        items: attivi.map((i) => ({
          id: i.id, kind: i.kind, sezione_id: i.sezione_id,
          titolo: i.titolo, payload: i.payload,
        })),
      });
      const filename = buildRelazioneFilename(club?.nome ?? "Club", stagione_nome);
      saveAs(blob, filename);
      const sizeStr = formatBytes(blob.size);
      toast.success(`Relazione PDF generata (${pages} pagine, ${sizeStr}). File scaricato come '${filename}'`);
    } catch (e: any) {
      if (e?.message === "Generazione gia in corso. Attendi il completamento.") {
        console.log("[PDF] Generazione gia in corso, click ignorato");
        return;
      }
      console.error(e);
      toast.error("Errore nella generazione del PDF. Riprova tra qualche secondo.");
    } finally {
      is_generating_ref.current = false;
      set_generating(false);
    }
  };

  const { data: prefs = [] } = useQuery({
    queryKey: ["relazione_prefs", club_id, stagione_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazione_preferenze" as any).select("*")
        .eq("club_id", club_id).eq("stagione_id", stagione_id);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: blocchi = [] } = useQuery({
    queryKey: ["relazione_comp_blocchi", club_id, stagione_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_blocchi_testo" as any).select("*")
        .eq("club_id", club_id).or(`stagione_id.eq.${stagione_id},stagione_id.is.null`)
        .order("ordine");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: allegati = [] } = useQuery({
    queryKey: ["relazione_comp_allegati", club_id, stagione_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relazioni_allegati" as any).select("*")
        .eq("club_id", club_id).or(`stagione_id.eq.${stagione_id},stagione_id.is.null`)
        .order("ordine");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Auto-seed default prefs if missing
  useEffect(() => {
    if (!club_id || !stagione_id) return;
    if (prefs.length > 0) return;
    (async () => {
      const rows = DEFAULT_PREFS.map((p) => ({ club_id, stagione_id, attivo: true, ...p }));
      await supabase.from("relazione_preferenze" as any).insert(rows);
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] });
    })();
  }, [club_id, stagione_id, prefs.length, qc]);

  const items: CompositoreItem[] = useMemo(() => {
    const list: CompositoreItem[] = [];
    for (const p of prefs as any[]) {
      const locked = p.sezione_tipo === "sistema";
      const kind = locked ? "sistema" : "area";
      const titolo = locked
        ? SISTEMA_LABELS[p.sezione_id] ?? p.sezione_id
        : AREA_DEFINITIONS[p.sezione_id]?.titolo ?? p.sezione_id;
      const sottotitolo = locked ? "Sezione di sistema" : `Area dashboard · ${AREA_DEFINITIONS[p.sezione_id]?.kpi ?? ""}`;
      list.push({
        id: `${kind === "sistema" ? "sis" : "area"}:${p.sezione_id}`,
        kind,
        sezione_id: p.sezione_id,
        titolo,
        sottotitolo,
        attivo: p.attivo,
        ordine: p.ordine,
        locked,
        payload: p,
      });
    }
    for (const b of blocchi as any[]) {
      list.push({
        id: `blo:${b.id}`,
        kind: "blocco",
        ref_id: b.id,
        titolo: b.titolo,
        sottotitolo: `Blocco · ${cat_blocco(b.categoria).label}`,
        attivo: !!b.attivo,
        ordine: b.ordine ?? 0,
        payload: b,
      });
    }
    for (const a of allegati as any[]) {
      list.push({
        id: `all:${a.id}`,
        kind: "allegato",
        ref_id: a.id,
        titolo: a.titolo,
        sottotitolo: `Allegato · ${cat_allegato(a.categoria).label}`,
        attivo: a.attivo !== false,
        ordine: a.ordine ?? 0,
        payload: a,
      });
    }
    const ordine_counts = list.reduce((acc, it) => acc.set(it.ordine, (acc.get(it.ordine) ?? 0) + 1), new Map<number, number>());
    const legacy_offsets = list.some((it) => (ordine_counts.get(it.ordine) ?? 0) > 1);
    return list
      .map((it) => ({
        ...it,
        ordine: legacy_offsets
          ? it.kind === "blocco"
            ? 100 + it.ordine
            : it.kind === "allegato"
              ? 500 + it.ordine
              : it.ordine
          : it.ordine,
      }))
      .sort((x, y) => x.ordine - y.ordine);
  }, [prefs, blocchi, allegati]);

  const m_reorder = useMutation({
    mutationFn: async (ordered_ids: string[]) => {
      await Promise.all(ordered_ids.map(async (id, idx) => {
        const new_ord = idx * 10;
        const it = items.find((i) => i.id === id);
        if (!it) return;
        if (it.kind === "sistema" || it.kind === "area") {
          const query = supabase.from("relazione_preferenze" as any).update({ ordine: new_ord });
          const { error } = it.payload?.id
            ? await query.eq("id", it.payload.id)
            : await query.eq("club_id", club_id).eq("stagione_id", stagione_id).eq("sezione_id", it.sezione_id!);
          if (error) throw error;
        } else if (it.kind === "blocco") {
          const { error } = await supabase.from("relazioni_blocchi_testo" as any).update({ ordine: new_ord }).eq("id", it.ref_id!);
          if (error) throw error;
        } else if (it.kind === "allegato") {
          const { error } = await supabase.from("relazioni_allegati" as any).update({ ordine: new_ord }).eq("id", it.ref_id!);
          if (error) throw error;
        }
      }));
    },
    onMutate: async (ordered_ids) => {
      saving_store.begin();
      const query_keys = [
        ["relazione_prefs", club_id, stagione_id],
        ["relazione_comp_blocchi", club_id, stagione_id],
        ["relazione_comp_allegati", club_id, stagione_id],
        ["relazioni_blocchi", club_id, stagione_id],
        ["relazioni_allegati", club_id, stagione_id],
      ];
      await Promise.all(query_keys.map((queryKey) => qc.cancelQueries({ queryKey })));
      const previous = query_keys.map((queryKey) => ({ queryKey, data: qc.getQueryData(queryKey) }));
      const ordine_by_id = new Map(ordered_ids.map((id, idx) => [id, idx * 10]));
      const sort_by_ordine = (rows: any[]) => [...rows].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));

      qc.setQueryData(["relazione_prefs", club_id, stagione_id], (old: any[] | undefined) => old ? sort_by_ordine(old.map((row) => {
        const key = `${row.sezione_tipo === "sistema" ? "sis" : "area"}:${row.sezione_id}`;
        return ordine_by_id.has(key) ? { ...row, ordine: ordine_by_id.get(key) } : row;
      })) : old);
      qc.setQueryData(["relazione_comp_blocchi", club_id, stagione_id], (old: any[] | undefined) => old ? sort_by_ordine(old.map((row) => ordine_by_id.has(`blo:${row.id}`) ? { ...row, ordine: ordine_by_id.get(`blo:${row.id}`) } : row)) : old);
      qc.setQueryData(["relazione_comp_allegati", club_id, stagione_id], (old: any[] | undefined) => old ? sort_by_ordine(old.map((row) => ordine_by_id.has(`all:${row.id}`) ? { ...row, ordine: ordine_by_id.get(`all:${row.id}`) } : row)) : old);

      return { previous };
    },
    onError: (error: any, _ids, context) => {
      context?.previous.forEach(({ queryKey, data }) => qc.setQueryData(queryKey, data));
      saving_store.error(error?.message ?? "Riordino non salvato");
      toast.error("Riordino non salvato");
    },
    onSuccess: () => { saving_store.success(); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_allegati", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] });
    },
  });

  const m_toggle = useMutation({
    mutationFn: async ({ item, attivo }: { item: CompositoreItem; attivo: boolean }) => {
      if (item.kind === "sistema" || item.kind === "area") {
        const { error } = await supabase.from("relazione_preferenze" as any).update({ attivo })
          .eq("club_id", club_id).eq("stagione_id", stagione_id).eq("sezione_id", item.sezione_id!);
        if (error) throw error;
      } else if (item.kind === "blocco") {
        const { error } = await supabase.from("relazioni_blocchi_testo" as any).update({ attivo }).eq("id", item.ref_id!);
        if (error) throw error;
      } else if (item.kind === "allegato") {
        const { error } = await supabase.from("relazioni_allegati" as any).update({ attivo }).eq("id", item.ref_id!);
        if (error) throw error;
      }
    },
    onMutate: () => { saving_store.begin(); },
    onError: (e: any) => { saving_store.error(e?.message ?? "Errore"); },
    onSuccess: () => {
      saving_store.success();
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_allegati", club_id, stagione_id] });
    },
  });

  const m_reset = useMutation({
    mutationFn: async () => {
      for (const p of DEFAULT_PREFS) {
        await supabase.from("relazione_preferenze" as any).update({ ordine: p.ordine, attivo: true })
          .eq("club_id", club_id).eq("stagione_id", stagione_id).eq("sezione_id", p.sezione_id);
      }
    },
    onMutate: () => { saving_store.begin(); },
    onError: (e: any) => { saving_store.error(e?.message ?? "Errore"); },
    onSuccess: () => {
      saving_store.success();
      toast.success("Ordine ripristinato");
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] });
    },
  });

  const handle_save_all = async () => {
    if (saving.pending > 0) {
      toast.info("Salvataggio in corso, attendi...");
      return;
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] }),
      qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] }),
      qc.invalidateQueries({ queryKey: ["relazione_comp_allegati", club_id, stagione_id] }),
    ]);
    saving_store.success();
    toast.success("Tutto salvato!");
  };

  const select = (id: string) => {
    set_selected_id(id);
    setTimeout(() => {
      document.getElementById(`pdf-page-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[38%_62%] gap-6 h-[calc(100vh-220px)] min-h-[600px]">
      <div className="border border-border rounded-md bg-card p-4 overflow-hidden flex flex-col">
        <div className="flex flex-col">
          <div className="flex gap-2 mb-3">
            <Button
              onClick={handle_generate}
              disabled={generating || items.filter((i) => i.attivo).length === 0}
              className={`gap-2 flex-1 ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span className="hidden sm:inline">{generating ? "Generazione in corso..." : "Genera PDF"}</span>
            </Button>
            <Button
              variant="outline"
              onClick={handle_save_all}
              disabled={saving.pending > 0}
              className="gap-2"
              title="Salva modifiche"
            >
              {saving.pending > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">Salva modifiche</span>
            </Button>
          </div>
          <p className="text-xs text-slate-500 text-center">
            La generazione richiede 2-3 secondi. Aspetta il completamento prima di cliccare di nuovo.
          </p>
        </div>
        <IndiceComponibile
          items={items}
          on_reorder={(ids) => m_reorder.mutate(ids)}
          on_toggle={(item, v) => m_toggle.mutate({ item, attivo: v })}
          on_select={select}
          selected_id={selected_id}
          on_reset={() => m_reset.mutate()}
        />
      </div>
      <div className="border border-border rounded-md bg-stone-100 overflow-y-auto">
        <AnteprimaPDF
          items={items}
          club={club}
          presidente={presidente}
          stagione_nome={stagione_nome}
          selected_id={selected_id}
        />
      </div>
    </div>
  );
}
