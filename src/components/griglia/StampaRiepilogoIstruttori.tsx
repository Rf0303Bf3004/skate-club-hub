import React from "react";
import { createPortal } from "react-dom";

export interface RigaSessioneStampa {
  ora_inizio: string;
  ora_fine: string;
  pista: string | null;
  specialita: string;
  specialita_descrizione: string | null;
  atleti: string[];
}

export interface IstruttoreStampa {
  istruttore_id: string;
  nome: string;
  sessioni: RigaSessioneStampa[];
}

interface Props {
  istruttori: IstruttoreStampa[];
  data_label: string;
}

/**
 * Blocco di stampa a flusso normale, montato in portal su document.body:
 * non eredita mai position:fixed né transform (che rendono vuota l'anteprima di stampa di Chrome).
 * A schermo è nascosto; visibile solo in @media print.
 */
const StampaRiepilogoIstruttori: React.FC<Props> = ({ istruttori, data_label }) => {
  if (typeof document === "undefined") return null;

  const dettaglio = (s: RigaSessioneStampa) => (
    <>
      {s.specialita_descrizione && (
        <p className="mt-1 text-[15pt] leading-snug">{s.specialita_descrizione}</p>
      )}
      <p className="mt-3 text-[15pt] font-semibold">Atleti:</p>
      {s.atleti.length > 0 ? (
        <ul className="mt-1 ml-6 list-disc text-[15pt] leading-relaxed">
          {s.atleti.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : (
        <p className="ml-1 text-[15pt]">—</p>
      )}
    </>
  );

  return createPortal(
    <div id="griglia-print-root" className="hidden print:block text-black">
      {istruttori.map((i, idx) => (
        <section
          key={i.istruttore_id}
          className="p-0"
          style={idx > 0 ? { breakBefore: "page", pageBreakBefore: "always" } : undefined}
        >
          <header className="border-b-4 border-black pb-3 mb-6">
            <h1 className="text-[34pt] font-extrabold leading-tight">{i.nome}</h1>
            <p className="text-[20pt] font-semibold capitalize">{data_label}</p>
          </header>

          {i.sessioni.length === 0 && <p className="text-[16pt]">Nessuna sessione.</p>}

          {i.sessioni.map((s, si) => (
            <div key={si} className="mb-8" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              {si === 0 ? (
                <p className="text-[24pt] font-extrabold leading-tight">
                  {s.ora_inizio}–{s.ora_fine}
                  {s.pista ? ` — ${s.pista}` : ""} — {s.specialita}
                </p>
              ) : (
                <p className="text-[20pt] font-bold leading-tight">
                  ↓ E poi, dalle {s.ora_inizio} alle {s.ora_fine}
                  {s.pista ? ` — ${s.pista}` : ""} — {s.specialita}
                </p>
              )}
              {dettaglio(s)}
            </div>
          ))}
        </section>
      ))}
    </div>,
    document.body,
  );
};

export default StampaRiepilogoIstruttori;
