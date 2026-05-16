import React from "react";

export const AREA_DEFINITIONS: Record<string, { numero: number; titolo: string; kpi: string; insight: string }> = {
  sintesi: {
    numero: 1, titolo: "Sintesi della stagione",
    kpi: "Quadro generale coerente",
    insight: "La stagione mostra crescita della domanda e tenuta economica; le aree critiche sono presidiate.",
  },
  domanda: {
    numero: 2, titolo: "Domanda & Ghiaccio",
    kpi: "92% saturazione ghiaccio · 14 in lista d'attesa",
    insight: "La domanda supera la capacità: una fascia oraria aggiuntiva consentirebbe di assorbire la lista d'attesa.",
  },
  atleti: {
    numero: 3, titolo: "Atleti",
    kpi: "145 atleti attivi (-2% YoY)",
    insight: "Pulcini in calo, Interbronzo in crescita: i ragazzi avanzano verso l'agonismo.",
  },
  economia: {
    numero: 4, titolo: "Economia",
    kpi: "Ricavi CHF 218'400 · Cassa CHF 41'200",
    insight: "Margine positivo del 6%, generato in particolare da corsi base e pacchetti opzionali.",
  },
  lezioni: {
    numero: 5, titolo: "Lezioni private",
    kpi: "412 ore erogate (+18% YoY)",
    insight: "Le lezioni private trainano i ricavi e fidelizzano gli agonisti.",
  },
  sportivo: {
    numero: 6, titolo: "Risultati sportivi",
    kpi: "27 podi · 9 medaglie d'oro",
    insight: "Stagione record: la maturazione del gruppo Argento porta i suoi frutti in gara.",
  },
  catalogo: {
    numero: 7, titolo: "Catalogo & Promozione",
    kpi: "5 sponsor attivi · CHF 19'000",
    insight: "Cinque partner sostengono il club; cerchiamo uno sponsor pista per coprire le ore aggiuntive.",
  },
};

export function MockAreaDashboard({ sezione_id, pagina }: { sezione_id: string; pagina: number }) {
  const a = AREA_DEFINITIONS[sezione_id];
  if (!a) return null;
  return (
    <PdfPage pagina={pagina}>
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Area {a.numero}</p>
      <h2 className="font-serif text-3xl text-stone-900 mb-6">{a.titolo}</h2>
      <div className="border-l-4 border-stone-300 pl-4 mb-6">
        <p className="font-serif text-2xl text-stone-800" style={{ fontFeatureSettings: "'tnum'" }}>{a.kpi}</p>
      </div>
      <p className="text-stone-700 leading-relaxed text-[15px] italic">{a.insight}</p>
      <div className="mt-8 p-4 border border-dashed border-stone-300 rounded text-xs text-stone-400 text-center">
        [grafico verrà incluso nel PDF finale]
      </div>
    </PdfPage>
  );
}

export function MockBlocco({ blocco, pagina }: { blocco: any; pagina: number }) {
  return (
    <PdfPage pagina={pagina}>
      <h2 className="font-serif text-3xl text-stone-900 mb-6">{blocco.titolo}</h2>
      <div className="text-stone-800 leading-relaxed text-[15px] whitespace-pre-wrap font-serif">
        {render_markdown_simple(blocco.contenuto || "")}
      </div>
    </PdfPage>
  );
}

export function MockAllegato({ allegato, pagina }: { allegato: any; pagina: number }) {
  return (
    <PdfPage pagina={pagina}>
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-24 h-32 border-2 border-stone-300 rounded flex items-center justify-center mb-6 bg-stone-50">
          <span className="font-serif text-3xl text-stone-400">PDF</span>
        </div>
        <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-widest bg-stone-900 text-stone-50 mb-4">Allegato</span>
        <h2 className="font-serif text-2xl text-stone-900 mb-2">{allegato.titolo}</h2>
        {allegato.descrizione && (
          <p className="text-stone-600 max-w-md text-sm mb-4">{allegato.descrizione}</p>
        )}
        <p className="text-xs text-stone-400 italic">Il PDF allegato sarà incluso nelle pagine successive del documento finale.</p>
      </div>
    </PdfPage>
  );
}

export function MockCopertina({ club, presidente, stagione, pagina }: any) {
  return (
    <PdfPage pagina={pagina}>
      <div className="flex flex-col items-center justify-center text-center py-20">
        <div className="w-20 h-20 rounded-full border-2 border-stone-300 flex items-center justify-center mb-6">
          <span className="font-serif text-2xl text-stone-400">{(club?.nome ?? "C").slice(0, 1)}</span>
        </div>
        <h1 className="font-serif text-4xl text-stone-900 mb-2">{club?.nome ?? "Club"}</h1>
        <p className="text-stone-500 text-sm uppercase tracking-widest mb-12">{club?.citta ?? ""}</p>
        <p className="font-serif text-2xl text-stone-800 mb-1">Relazione di fine stagione</p>
        <p className="font-serif text-xl text-stone-600 mb-12">{stagione ?? "Stagione"}</p>
        <div className="text-xs text-stone-500 uppercase tracking-widest">Presidente</div>
        <p className="font-serif text-lg text-stone-800">{presidente ?? "—"}</p>
      </div>
    </PdfPage>
  );
}

export function MockIndice({ items, pagina }: { items: { titolo: string; pagina: number }[]; pagina: number }) {
  return (
    <PdfPage pagina={pagina}>
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Indice</p>
      <h2 className="font-serif text-3xl text-stone-900 mb-8">Sommario</h2>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-baseline gap-2 font-serif text-stone-800">
            <span>{it.titolo}</span>
            <span className="flex-1 border-b border-dotted border-stone-300 mx-2" />
            <span className="text-stone-500 tabular-nums">{it.pagina}</span>
          </li>
        ))}
      </ul>
    </PdfPage>
  );
}

export function MockChiusura({ club, stagione, pagina }: any) {
  return (
    <PdfPage pagina={pagina}>
      <div className="flex flex-col items-center justify-center text-center py-32">
        <p className="font-serif text-stone-600 text-base italic">
          {(club?.nome ?? "Club")} — {stagione ?? "Stagione"} — Relazione del Presidente
        </p>
      </div>
    </PdfPage>
  );
}

function PdfPage({ children, pagina }: { children: React.ReactNode; pagina: number }) {
  return (
    <div
      className="bg-[#FEFCF7] shadow-md border border-stone-200 mx-auto"
      style={{ width: 595, minHeight: 842, padding: "60px 70px 50px 70px" }}
    >
      <div className="min-h-[700px]">{children}</div>
      <div className="text-center text-[10px] text-stone-400 mt-4 tabular-nums">— {pagina} —</div>
    </div>
  );
}

function render_markdown_simple(text: string) {
  // Render basic bold (**...**) and italic (*...*) inline
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/;
    while (true) {
      const m = remaining.match(regex);
      if (!m || m.index === undefined) {
        parts.push(remaining);
        break;
      }
      parts.push(remaining.slice(0, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
      else parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
      remaining = remaining.slice(m.index + tok.length);
    }
    return (
      <React.Fragment key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}
