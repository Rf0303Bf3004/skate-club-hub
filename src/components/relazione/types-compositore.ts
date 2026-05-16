export type CompositoreKind = "sistema" | "area" | "blocco" | "allegato";

export interface CompositoreItem {
  id: string;                  // unique within composer: e.g. "sis:copertina", "area:atleti", "blo:<uuid>", "all:<uuid>"
  kind: CompositoreKind;
  sezione_id?: string;         // for sistema/area
  ref_id?: string;             // for blocco/allegato (db id)
  titolo: string;
  sottotitolo: string;
  attivo: boolean;
  ordine: number;
  locked?: boolean;            // sistema items: cannot disable / drag
  payload?: any;               // raw row
}

export const SISTEMA_LABELS: Record<string, string> = {
  copertina: "Copertina",
  indice: "Indice",
  chiusura: "Chiusura",
};
