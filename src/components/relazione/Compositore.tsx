import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import IndiceComponibile from "./IndiceComponibile";
import AnteprimaPDF from "./AnteprimaPDF";
import { CompositoreItem, SISTEMA_LABELS } from "./types-compositore";
import { AREA_DEFINITIONS } from "./MockSezionePDF";
import { cat_blocco, cat_allegato } from "./categorie";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { saveAs } from "file-saver";
import { generateRelazionePDF, buildRelazioneFilename } from "@/lib/pdfGenerator";

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

  const handle_generate = async () => {
    set_generating(true);
    try {
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
      toast.success(`Relazione PDF generata (${pages} pagine)`);
    } catch (e: any) {
      console.error(e);
      toast.error("Errore generazione PDF: " + (e?.message ?? "sconosciuto"));
    } finally {
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
        ordine: 100 + (b.ordine ?? 0), // push blocchi after areas by default
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
        ordine: 500 + (a.ordine ?? 0),
        payload: a,
      });
    }
    return list.sort((x, y) => x.ordine - y.ordine);
  }, [prefs, blocchi, allegati]);

  const m_reorder = useMutation({
    mutationFn: async (ordered_ids: string[]) => {
      const ops = ordered_ids.map((id, idx) => {
        const new_ord = (idx + 1) * 10;
        const it = items.find((i) => i.id === id);
        if (!it) return null;
        if (it.kind === "sistema" || it.kind === "area") {
          return supabase.from("relazione_preferenze" as any).update({ ordine: new_ord })
            .eq("club_id", club_id).eq("stagione_id", stagione_id).eq("sezione_id", it.sezione_id!);
        } else if (it.kind === "blocco") {
          return supabase.from("relazioni_blocchi_testo" as any).update({ ordine: new_ord }).eq("id", it.ref_id!);
        } else if (it.kind === "allegato") {
          return supabase.from("relazioni_allegati" as any).update({ ordine: new_ord }).eq("id", it.ref_id!);
        }
        return null;
      }).filter(Boolean) as unknown as Promise<any>[];
      await Promise.all(ops);
    },
    onError: () => toast.error("Riordino non salvato"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_allegati", club_id, stagione_id] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_blocchi", club_id, stagione_id] });
      qc.invalidateQueries({ queryKey: ["relazione_comp_allegati", club_id, stagione_id] });
    },
  });

  const m_reset = useMutation({
    mutationFn: async () => {
      // restore default ordini + attivo true for sistema/area
      for (const p of DEFAULT_PREFS) {
        await supabase.from("relazione_preferenze" as any).update({ ordine: p.ordine, attivo: true })
          .eq("club_id", club_id).eq("stagione_id", stagione_id).eq("sezione_id", p.sezione_id);
      }
    },
    onSuccess: () => {
      toast.success("Ordine ripristinato");
      qc.invalidateQueries({ queryKey: ["relazione_prefs", club_id, stagione_id] });
    },
  });

  const select = (id: string) => {
    set_selected_id(id);
    setTimeout(() => {
      document.getElementById(`pdf-page-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[38%_62%] gap-6 h-[calc(100vh-220px)] min-h-[600px]">
      <div className="border border-border rounded-md bg-card p-4 overflow-hidden flex flex-col">
        <Button
          onClick={handle_generate}
          disabled={generating || items.filter((i) => i.attivo).length === 0}
          className="mb-3 gap-2 w-full"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {generating ? "Generazione in corso..." : "Genera PDF"}
        </Button>
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
