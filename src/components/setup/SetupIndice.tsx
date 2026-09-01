import React from "react";

export interface VoceIndice {
  id: string;
  label: string;
}

/**
 * Indice a pastiglie delle sezioni del tab corrente.
 * La pastiglia della sezione visibile a schermo si evidenzia da sola.
 */
export const SetupIndice: React.FC<{ voci: VoceIndice[] }> = ({ voci }) => {
  const [attiva, set_attiva] = React.useState<string | null>(voci[0]?.id ?? null);
  const chiavi = voci.map((v) => v.id).join("|");

  React.useEffect(() => {
    const ids = chiavi ? chiavi.split("|") : [];
    const elementi = ids
      .map((id) => document.getElementById(`sez-${id}`))
      .filter((e): e is HTMLElement => !!e);
    if (elementi.length === 0) return;

    const visibili = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-setup-section") ?? "";
          if (entry.isIntersecting) visibili.add(id);
          else visibili.delete(id);
        }
        const prima = ids.find((id) => visibili.has(id));
        if (prima) set_attiva(prima);
      },
      { rootMargin: "-180px 0px -60% 0px", threshold: 0 }
    );
    elementi.forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [chiavi]);

  const vai_a = (id: string) => {
    const el = document.getElementById(`sez-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      set_attiva(id);
    }
  };

  if (voci.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none py-2">
      {voci.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => vai_a(v.id)}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            attiva === v.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
};

export default SetupIndice;
