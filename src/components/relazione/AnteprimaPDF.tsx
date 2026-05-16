import React from "react";
import { CompositoreItem } from "./types-compositore";
import { MockAreaDashboard, MockAllegato, MockBlocco, MockChiusura, MockCopertina, MockIndice, AREA_DEFINITIONS } from "./MockSezionePDF";

interface Props {
  items: CompositoreItem[];
  club: any;
  presidente: string;
  stagione_nome: string;
  selected_id: string | null;
}

export default function AnteprimaPDF({ items, club, presidente, stagione_nome, selected_id }: Props) {
  const attivi = items.filter((i) => i.attivo);
  // build indice items
  const indice_entries: { titolo: string; pagina: number; item_id: string }[] = [];
  let p = 1;
  const pages_map: { item: CompositoreItem; pagina: number }[] = [];
  for (const it of attivi) {
    pages_map.push({ item: it, pagina: p });
    let title = it.titolo;
    if (it.kind === "area") title = `${AREA_DEFINITIONS[it.sezione_id!]?.numero ?? ""}. ${AREA_DEFINITIONS[it.sezione_id!]?.titolo ?? it.titolo}`;
    indice_entries.push({ titolo: title, pagina: p, item_id: it.id });
    p += 1;
  }

  return (
    <div className="space-y-6 py-6">
      {pages_map.map(({ item, pagina }) => (
        <div
          key={item.id}
          id={`pdf-page-${item.id}`}
          className={`transition-all duration-150 ${selected_id === item.id ? "ring-4 ring-primary/40 rounded" : ""}`}
        >
          {item.kind === "sistema" && item.sezione_id === "copertina" && (
            <MockCopertina club={club} presidente={presidente} stagione={stagione_nome} pagina={pagina} />
          )}
          {item.kind === "sistema" && item.sezione_id === "indice" && (
            <MockIndice items={indice_entries.filter((e) => e.item_id !== item.id)} pagina={pagina} />
          )}
          {item.kind === "sistema" && item.sezione_id === "chiusura" && (
            <MockChiusura club={club} stagione={stagione_nome} pagina={pagina} />
          )}
          {item.kind === "area" && item.sezione_id && (
            <MockAreaDashboard sezione_id={item.sezione_id} pagina={pagina} />
          )}
          {item.kind === "blocco" && <MockBlocco blocco={item.payload} pagina={pagina} />}
          {item.kind === "allegato" && <MockAllegato allegato={item.payload} pagina={pagina} />}
        </div>
      ))}
    </div>
  );
}
