import React from "react";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { use_ragioni_sociali, use_listini_ragione_sociale } from "@/hooks/use-ragioni-sociali";
import { Label } from "@/components/ui/label";

interface Props {
  ragione_sociale_id: string | null;
  ragione_sociale_listino_id: string | null;
  on_change: (patch: { ragione_sociale_id?: string | null; ragione_sociale_listino_id?: string | null }) => void;
  /** Se true usa il layout card autonomo (scheda completa atleta). */
  as_card?: boolean;
}

/**
 * Selettori a cascata Ragione sociale → Listino per l'atleta.
 * Visibili SOLO se la modalità dell'area "fatturazione" è "multi_ragione_sociale".
 */
export const FatturazioneAtletaFields: React.FC<Props> = ({
  ragione_sociale_id,
  ragione_sociale_listino_id,
  on_change,
  as_card = false,
}) => {
  const { modalita } = useModalitaArea("fatturazione");
  const { data: ragioni = [] } = use_ragioni_sociali();
  const { data: listini = [] } = use_listini_ragione_sociale(ragione_sociale_id);

  if (modalita !== "multi_ragione_sociale") return null;

  const select_cls =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50";

  const body = (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Ragione sociale</Label>
        <select
          className={select_cls}
          value={ragione_sociale_id ?? ""}
          onChange={(e) =>
            on_change({
              ragione_sociale_id: e.target.value || null,
              ragione_sociale_listino_id: null,
            })
          }
        >
          <option value="">— Nessuna (default club) —</option>
          {ragioni.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Listino</Label>
        <select
          className={select_cls}
          value={ragione_sociale_listino_id ?? ""}
          disabled={!ragione_sociale_id}
          onChange={(e) => on_change({ ragione_sociale_listino_id: e.target.value || null })}
        >
          <option value="">
            {ragione_sociale_id ? "— Nessuno —" : "Scegli prima la ragione sociale"}
          </option>
          {listini.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
              {l.prezzo_slot_chf != null ? ` — CHF ${Number(l.prezzo_slot_chf).toFixed(2)}/slot` : ""}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  if (!as_card) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fatturazione</p>
        {body}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
      <h3 className="text-sm font-bold text-foreground">Fatturazione</h3>
      {body}
    </div>
  );
};

export default FatturazioneAtletaFields;
