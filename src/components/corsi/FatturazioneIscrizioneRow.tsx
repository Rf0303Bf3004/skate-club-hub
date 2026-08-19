import React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { use_ragioni_sociali, use_listini_ragione_sociale } from "@/hooks/use-ragioni-sociali";
import { toast } from "@/hooks/use-toast";

interface Props {
  corso_id: string;
  atleta_id: string;
}

/**
 * Selettori compatti Ragione sociale → Listino per la SINGOLA iscrizione a corso.
 * Visibile solo se l'area "fatturazione" è in modalità multi_ragione_sociale.
 * I valori sono precompilati all'iscrizione dai default dell'atleta, ma modificabili qui.
 */
export const FatturazioneIscrizioneRow: React.FC<Props> = ({ corso_id, atleta_id }) => {
  const { modalita } = useModalitaArea("fatturazione");
  const qc = useQueryClient();
  const { data: ragioni = [] } = use_ragioni_sociali();

  const { data: iscrizione } = useQuery({
    queryKey: ["iscrizione_fatturazione", corso_id, atleta_id],
    enabled: modalita === "multi_ragione_sociale",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iscrizioni_corsi")
        .select("id,ragione_sociale_id,ragione_sociale_listino_id")
        .eq("corso_id", corso_id)
        .eq("atleta_id", atleta_id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: listini = [] } = use_listini_ragione_sociale(iscrizione?.ragione_sociale_id ?? null);

  const salva = useMutation({
    mutationFn: async (patch: {
      ragione_sociale_id?: string | null;
      ragione_sociale_listino_id?: string | null;
    }) => {
      if (!iscrizione?.id) return;
      const { error } = await supabase.from("iscrizioni_corsi").update(patch).eq("id", iscrizione.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iscrizione_fatturazione", corso_id, atleta_id] });
    },
    onError: (e: any) => toast({ title: "Errore salvataggio", description: e.message, variant: "destructive" }),
  });

  if (modalita !== "multi_ragione_sociale" || !iscrizione) return null;

  const select_cls = "h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fatturazione</span>
      <select
        className={select_cls}
        value={iscrizione.ragione_sociale_id ?? ""}
        onChange={(e) =>
          salva.mutate({
            ragione_sociale_id: e.target.value || null,
            ragione_sociale_listino_id: null,
          })
        }
      >
        <option value="">— Default atleta —</option>
        {ragioni.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nome}
          </option>
        ))}
      </select>
      <select
        className={select_cls}
        value={iscrizione.ragione_sociale_listino_id ?? ""}
        disabled={!iscrizione.ragione_sociale_id}
        onChange={(e) => salva.mutate({ ragione_sociale_listino_id: e.target.value || null })}
      >
        <option value="">{iscrizione.ragione_sociale_id ? "— Nessun listino —" : "Scegli ragione sociale"}</option>
        {listini.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
            {l.prezzo_slot_chf != null ? ` — CHF ${Number(l.prezzo_slot_chf).toFixed(2)}/slot` : ""}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FatturazioneIscrizioneRow;
