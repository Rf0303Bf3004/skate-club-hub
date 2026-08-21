import React from "react";
import { createPortal } from "react-dom";

export interface TableauEvento {
  id: string;
  risorsa_id: string;
  inizio_min: number;
  fine_min: number;
  titolo: string;
  istruttori: string;
  fuori_disponibilita?: boolean;
}

export interface TableauCorsia {
  id: string;
  nome: string;
  tipo: "ghiaccio" | "palestra";
  colore: string | null;
}

export type FormatoCarta = "A4" | "A3";

interface Props {
  corsie: TableauCorsia[];
  eventi: TableauEvento[];
  min_inizio: number;
  min_fine: number;
  data_label: string;
  formato: FormatoCarta;
  /** millimetri per minuto sull'asse del tempo */
  mm_per_min?: number;
}

const PAGINA_MM: Record<FormatoCarta, { w: number; h: number }> = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
};

const MARGINE_MM = 12;
const COL_LABEL_MM = 38;
const HEADER_MM = 20;
const ALTEZZA_CORSIA_MM = 22;

export function hhmm_da_min(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Tableau poster: swimlane orizzontali (una per risorsa), asse tempo orizzontale.
 * Montato in portal su document.body a flusso normale (mai position:fixed),
 * nascosto a schermo e visibile solo in @media print.
 */
const TableauPosterStampa: React.FC<Props> = ({
  corsie,
  eventi,
  min_inizio,
  min_fine,
  data_label,
  formato,
  mm_per_min = 0.8,
}) => {
  if (typeof document === "undefined") return null;

  const pagina = PAGINA_MM[formato];
  const larghezza_utile = pagina.w - MARGINE_MM * 2;
  const larghezza_tempo = larghezza_utile - COL_LABEL_MM;

  // minuti che entrano in un foglio, arrotondati a 30'
  const minuti_grezzi = Math.floor(larghezza_tempo / mm_per_min);
  const minuti_per_foglio = Math.max(60, Math.floor(minuti_grezzi / 30) * 30);

  const durata_totale = Math.max(60, min_fine - min_inizio);
  const n_fogli = Math.max(1, Math.ceil(durata_totale / minuti_per_foglio));

  const fogli = Array.from({ length: n_fogli }, (_, i) => {
    const da = min_inizio + i * minuti_per_foglio;
    const a = Math.min(min_fine, da + minuti_per_foglio);
    return { da, a, indice: i + 1 };
  });

  const ore_tick = (da: number, a: number) => {
    const out: number[] = [];
    const primo = Math.ceil(da / 60) * 60;
    for (let t = primo; t <= a; t += 60) out.push(t);
    return out;
  };

  const mezzore_tick = (da: number, a: number) => {
    const out: number[] = [];
    const primo = Math.ceil(da / 30) * 30;
    for (let t = primo; t <= a; t += 30) if (t % 60 !== 0) out.push(t);
    return out;
  };

  const crop = (pos: React.CSSProperties) => (
    <div style={{ position: "absolute", ...pos, width: "8mm", height: "8mm" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "4mm",
          width: "8mm",
          height: 0,
          borderTop: "0.3mm solid #000",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "4mm",
          height: "8mm",
          width: 0,
          borderLeft: "0.3mm solid #000",
        }}
      />
    </div>
  );

  const altezza_griglia = corsie.length * ALTEZZA_CORSIA_MM;

  return createPortal(
    <div id="tableau-print-root" className="hidden print:block">
      <style>{`@page { size: ${formato} landscape; margin: 0; }`}</style>

      {fogli.map((f) => {
        const durata_foglio = f.a - f.da;
        const larghezza_disegno = durata_foglio * mm_per_min;
        // ora tonda più vicina ai bordi del foglio (riferimento di allineamento)
        const ore = ore_tick(f.da, f.a);
        const rif_sx = ore[0];
        const rif_dx = ore[ore.length - 1];

        return (
          <div
            key={f.indice}
            style={{
              position: "relative",
              width: `${pagina.w}mm`,
              height: `${pagina.h}mm`,
              boxSizing: "border-box",
              padding: `${MARGINE_MM}mm`,
              background: "#fff",
              color: "#000",
              overflow: "hidden",
              breakAfter: f.indice < n_fogli ? "page" : "auto",
              pageBreakAfter: f.indice < n_fogli ? "always" : "auto",
            }}
          >
            {/* crop marks: stessa quota verticale su tutti i fogli */}
            {crop({ left: "2mm", top: `${MARGINE_MM - 4}mm` })}
            {crop({ right: "2mm", top: `${MARGINE_MM - 4}mm` })}
            {crop({ left: "2mm", bottom: `${MARGINE_MM - 4}mm` })}
            {crop({ right: "2mm", bottom: `${MARGINE_MM - 4}mm` })}

            {/* intestazione */}
            <div
              style={{
                height: `${HEADER_MM}mm`,
                borderBottom: "0.8mm solid #000",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                paddingBottom: "2mm",
              }}
            >
              <div>
                <div style={{ fontSize: "16pt", fontWeight: 800, lineHeight: 1.1 }}>Tableau giornaliero</div>
                <div style={{ fontSize: "11pt", fontWeight: 600, textTransform: "capitalize" }}>{data_label}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: "10pt", fontWeight: 700 }}>
                <div>
                  Foglio {f.indice} di {n_fogli}
                </div>
                <div style={{ fontWeight: 500 }}>
                  {hhmm_da_min(f.da)} – {hhmm_da_min(f.a)}
                </div>
              </div>
            </div>

            {/* corpo */}
            <div style={{ position: "relative", marginTop: "4mm" }}>
              {/* riga ore */}
              <div style={{ display: "flex", height: "6mm" }}>
                <div style={{ width: `${COL_LABEL_MM}mm`, flex: "0 0 auto" }} />
                <div style={{ position: "relative", width: `${larghezza_disegno}mm` }}>
                  {ore.map((t) => (
                    <div
                      key={t}
                      style={{
                        position: "absolute",
                        left: `${(t - f.da) * mm_per_min}mm`,
                        transform: "translateX(-50%)",
                        fontSize: "9pt",
                        fontWeight: 700,
                      }}
                    >
                      {hhmm_da_min(t)}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex" }}>
                {/* etichette corsie */}
                <div style={{ width: `${COL_LABEL_MM}mm`, flex: "0 0 auto" }}>
                  {corsie.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        height: `${ALTEZZA_CORSIA_MM}mm`,
                        borderTop: "0.2mm solid #999",
                        borderLeft: `1.5mm solid ${c.colore || "#333"}`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        paddingLeft: "2mm",
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ fontSize: "10pt", fontWeight: 800, lineHeight: 1.1 }}>{c.nome}</div>
                      <div style={{ fontSize: "7pt", textTransform: "uppercase", letterSpacing: "0.4pt" }}>
                        {c.tipo === "ghiaccio" ? "Ghiaccio" : "Off Ice"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* area tempo */}
                <div
                  style={{
                    position: "relative",
                    width: `${larghezza_disegno}mm`,
                    height: `${altezza_griglia}mm`,
                    borderLeft: "0.3mm solid #000",
                  }}
                >
                  {/* griglia mezz'ore */}
                  {mezzore_tick(f.da, f.a).map((t) => (
                    <div
                      key={`h${t}`}
                      style={{
                        position: "absolute",
                        left: `${(t - f.da) * mm_per_min}mm`,
                        top: 0,
                        bottom: 0,
                        borderLeft: "0.15mm dotted #bbb",
                      }}
                    />
                  ))}
                  {/* griglia ore */}
                  {ore.map((t) => (
                    <div
                      key={`o${t}`}
                      style={{
                        position: "absolute",
                        left: `${(t - f.da) * mm_per_min}mm`,
                        top: 0,
                        bottom: 0,
                        borderLeft: "0.25mm solid #999",
                      }}
                    />
                  ))}
                  {/* linee di riferimento allineamento (ora tonda vicino ai bordi) */}
                  {[rif_sx, rif_dx].filter((v) => v !== undefined).map((t, i) => (
                    <div
                      key={`rif${i}`}
                      style={{
                        position: "absolute",
                        left: `${(t! - f.da) * mm_per_min}mm`,
                        top: `-${HEADER_MM}mm`,
                        height: `${altezza_griglia + HEADER_MM + 8}mm`,
                        borderLeft: "0.2mm dashed #666",
                      }}
                    />
                  ))}

                  {/* corsie + eventi */}
                  {corsie.map((c, idx) => {
                    const items = eventi.filter(
                      (e) => e.risorsa_id === c.id && e.fine_min > f.da && e.inizio_min < f.a,
                    );
                    return (
                      <div
                        key={c.id}
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${idx * ALTEZZA_CORSIA_MM}mm`,
                          height: `${ALTEZZA_CORSIA_MM}mm`,
                          borderTop: "0.2mm solid #999",
                        }}
                      >
                        {items.map((e) => {
                          const da = Math.max(e.inizio_min, f.da);
                          const a = Math.min(e.fine_min, f.a);
                          return (
                            <div
                              key={e.id}
                              style={{
                                position: "absolute",
                                left: `${(da - f.da) * mm_per_min}mm`,
                                width: `${Math.max(6, (a - da) * mm_per_min)}mm`,
                                top: "1.5mm",
                                height: `${ALTEZZA_CORSIA_MM - 3}mm`,
                                boxSizing: "border-box",
                                border: `0.3mm solid ${c.colore || "#333"}`,
                                borderLeft: `1.2mm solid ${c.colore || "#333"}`,
                                borderRadius: "1mm",
                                background: "#f4f6fa",
                                padding: "0.8mm 1mm",
                                overflow: "hidden",
                              }}
                            >
                              <div style={{ fontSize: "7.5pt", fontWeight: 800, lineHeight: 1.05 }}>
                                {hhmm_da_min(e.inizio_min)}–{hhmm_da_min(e.fine_min)}
                                {e.fuori_disponibilita ? " ⚠" : ""}
                              </div>
                              <div style={{ fontSize: "8pt", fontWeight: 700, lineHeight: 1.1 }}>{e.titolo}</div>
                              {e.istruttori && (
                                <div style={{ fontSize: "7pt", lineHeight: 1.1 }}>{e.istruttori}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderBottom: "0.2mm solid #999" }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
};

export default TableauPosterStampa;

/** Calcola quanti fogli servono e le fasce orarie coperte (stessa logica del render). */
export function calcola_fogli(
  formato: FormatoCarta,
  min_inizio: number,
  min_fine: number,
  mm_per_min = 0.8,
): { da: number; a: number; indice: number }[] {
  const pagina = PAGINA_MM[formato];
  const larghezza_tempo = pagina.w - MARGINE_MM * 2 - COL_LABEL_MM;
  const minuti_per_foglio = Math.max(60, Math.floor(Math.floor(larghezza_tempo / mm_per_min) / 30) * 30);
  const durata = Math.max(60, min_fine - min_inizio);
  const n = Math.max(1, Math.ceil(durata / minuti_per_foglio));
  return Array.from({ length: n }, (_, i) => {
    const da = min_inizio + i * minuti_per_foglio;
    return { da, a: Math.min(min_fine, da + minuti_per_foglio), indice: i + 1 };
  });
}
