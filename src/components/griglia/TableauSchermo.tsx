import React from "react";
import {
  hhmm_da_min,
  impacchetta_sottorighe,
  type TableauCorsia,
  type TableauEvento,
  colore_evento,
} from "@/components/griglia/TableauPosterStampa";
import { use_disponibilita_giorno } from "@/hooks/use-griglia-ghiaccio";
import { Snowflake, Dumbbell, AlertTriangle } from "lucide-react";

interface Props {
  corsie: TableauCorsia[];
  eventi: TableauEvento[];
  min_inizio: number;
  min_fine: number;
  /** giorno della settimana in italiano (es. "Lunedì"), per leggere la disponibilità */
  giorno_settimana: string;
}

const PX_PER_MIN = 2.2;
const LABEL_PX = 190;
const ALTEZZA_SOTTORIGA_PX = 56;

function min_da_hhmm(t?: string | null): number {
  const [h, m] = (t ?? "").slice(0, 5).split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

/** Riga (corsia) di una singola risorsa: sfondo disponibilità + eventi su sotto-righe. */
const CorsiaRiga: React.FC<{
  corsia: TableauCorsia;
  eventi: TableauEvento[];
  min_inizio: number;
  min_fine: number;
  giorno_settimana: string;
  larghezza_px: number;
}> = ({ corsia, eventi, min_inizio, min_fine, giorno_settimana, larghezza_px }) => {
  const { data: fasce_ghiaccio = [] } = use_disponibilita_giorno(corsia.id, giorno_settimana, "ghiaccio");
  const { data: fasce_pulizia = [] } = use_disponibilita_giorno(
    corsia.id,
    corsia.tipo === "ghiaccio" ? giorno_settimana : null,
    "pulizia",
  );

  const { riga_per_evento, n_righe } = impacchetta_sottorighe(eventi);
  const altezza = n_righe * ALTEZZA_SOTTORIGA_PX;
  const colore = corsia.colore || "hsl(var(--primary))";

  const fascia_box = (f: { ora_inizio: string; ora_fine: string }) => {
    const da = Math.max(min_da_hhmm(f.ora_inizio), min_inizio);
    const a = Math.min(min_da_hhmm(f.ora_fine), min_fine);
    if (a <= da) return null;
    return { left: (da - min_inizio) * PX_PER_MIN, width: (a - da) * PX_PER_MIN };
  };

  return (
    <div className="flex border-b last:border-b-0">
      {/* etichetta sticky */}
      <div
        className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r bg-background px-3 py-2"
        style={{ width: LABEL_PX, height: altezza, borderLeft: `4px solid ${colore}` }}
      >
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {corsia.tipo === "ghiaccio" ? (
            <Snowflake className="h-3.5 w-3.5 text-sky-600" />
          ) : (
            <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="truncate">{corsia.nome}</span>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {corsia.tipo === "ghiaccio" ? "Ghiaccio" : "Off ice"}
          {n_righe > 1 ? ` · ${n_righe} gruppi` : ""}
        </span>
      </div>

      {/* canvas della corsia */}
      <div className="relative bg-muted/40" style={{ width: larghezza_px, height: altezza }}>
        {/* fasce disponibili */}
        {fasce_ghiaccio.map((f, i) => {
          const box = fascia_box(f);
          if (!box) return null;
          return (
            <div
              key={`g${i}`}
              className="absolute top-0 bottom-0 bg-emerald-100/70 border-x border-emerald-200"
              style={{ left: box.left, width: box.width }}
            />
          );
        })}
        {/* fasce di pulizia */}
        {fasce_pulizia.map((f, i) => {
          const box = fascia_box(f);
          if (!box) return null;
          return (
            <div
              key={`p${i}`}
              className="absolute top-0 bottom-0 border-x border-muted-foreground/30"
              style={{
                left: box.left,
                width: box.width,
                backgroundImage:
                  "repeating-linear-gradient(45deg, hsl(var(--muted-foreground)/0.25) 0 4px, transparent 4px 8px)",
              }}
            />
          );
        })}
        {/* griglia oraria */}
        {Array.from({ length: Math.floor((min_fine - min_inizio) / 30) + 1 }, (_, i) => min_inizio + i * 30).map(
          (t) => (
            <div
              key={t}
              className={`absolute top-0 bottom-0 border-l ${t % 60 === 0 ? "border-border" : "border-border/40"}`}
              style={{ left: (t - min_inizio) * PX_PER_MIN }}
            />
          ),
        )}

        {/* eventi sopra lo sfondo */}
        {eventi.map((e) => {
          const da = Math.max(e.inizio_min, min_inizio);
          const a = Math.min(e.fine_min, min_fine);
          if (a <= da) return null;
          const riga = riga_per_evento[e.id] ?? 0;
          const colore_ev = n_righe > 1 ? colore_evento(e.titolo) : colore;
          return (
            <div
              key={e.id}
              className="absolute overflow-hidden rounded-md border bg-card px-2 py-1 shadow-sm"
              style={{
                left: (da - min_inizio) * PX_PER_MIN,
                width: Math.max(48, (a - da) * PX_PER_MIN - 3),
                top: riga * ALTEZZA_SOTTORIGA_PX + 4,
                height: ALTEZZA_SOTTORIGA_PX - 8,
                borderColor: colore_ev,
                borderLeftWidth: 4,
                borderLeftColor: colore_ev,
              }}
              title={`${hhmm_da_min(e.inizio_min)}–${hhmm_da_min(e.fine_min)} · ${e.titolo}${e.istruttori ? ` · ${e.istruttori}` : ""}`}
            >
              <div className="flex items-center gap-1 text-[10px] font-bold leading-tight">
                {hhmm_da_min(e.inizio_min)}–{hhmm_da_min(e.fine_min)}
                {e.fuori_disponibilita && <AlertTriangle className="h-3 w-3 text-amber-600" />}
              </div>
              <div className="truncate text-xs font-semibold leading-tight">{e.titolo}</div>
              {e.istruttori && (
                <div className="truncate text-[10px] italic leading-tight text-muted-foreground">{e.istruttori}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Tableau continuo a schermo: corsie orizzontali per risorsa, scroll orizzontale, nessuna paginazione. */
const TableauSchermo: React.FC<Props> = ({ corsie, eventi, min_inizio, min_fine, giorno_settimana }) => {
  const larghezza_px = Math.max(1, min_fine - min_inizio) * PX_PER_MIN;
  const ore = Array.from(
    { length: Math.floor(min_fine / 60) - Math.ceil(min_inizio / 60) + 1 },
    (_, i) => (Math.ceil(min_inizio / 60) + i) * 60,
  );

  if (corsie.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-sm text-muted-foreground">
        Nessuna risorsa attiva per questo giorno.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border border-emerald-200 bg-emerald-100" /> Disponibile
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded border border-muted-foreground/30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, hsl(var(--muted-foreground)/0.25) 0 4px, transparent 4px 8px)",
            }}
          />{" "}
          Pulizia ghiaccio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-muted" /> Non dichiarato
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <div style={{ width: LABEL_PX + larghezza_px }}>
          {/* righello ore */}
          <div className="flex border-b bg-muted/30">
            <div className="sticky left-0 z-20 shrink-0 border-r bg-muted/30 px-3 py-1.5 text-xs font-semibold" style={{ width: LABEL_PX }}>
              Risorsa
            </div>
            <div className="relative h-8" style={{ width: larghezza_px }}>
              {ore.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 border-l border-border pl-1 text-[11px] font-semibold"
                  style={{ left: (t - min_inizio) * PX_PER_MIN }}
                >
                  {hhmm_da_min(t)}
                </div>
              ))}
            </div>
          </div>

          {corsie.map((c) => (
            <CorsiaRiga
              key={c.id}
              corsia={c}
              eventi={eventi.filter((e) => e.risorsa_id === c.id)}
              min_inizio={min_inizio}
              min_fine={min_fine}
              giorno_settimana={giorno_settimana}
              larghezza_px={larghezza_px}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TableauSchermo;
