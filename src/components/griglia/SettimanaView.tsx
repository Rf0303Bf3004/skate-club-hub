import React, { useMemo } from "react";
import { Snowflake, Dumbbell, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import EventoUnificatoBox from "@/components/griglia/EventoUnificatoBox";
import {
  use_eventi_unificati,
  add_giorni,
  lunedi_di_iso,
  type EventoUnificato,
} from "@/hooks/use-planning-unificato";

const PX_PER_MIN = 1.1;
const GUTTER_PX = 52;

interface Props {
  /** una data qualsiasi della settimana da mostrare */
  data_sel: string;
  includi_ospiti: boolean;
  on_cambia_data: (data_iso: string) => void;
  /** apre la vista giorno su quella data */
  on_apri_giorno: (data_iso: string) => void;
  /** naviga al Planning classico su quella data */
  on_apri_planning: (data_iso: string) => void;
}

function label_giorno(data_iso: string): string {
  const d = new Date(`${data_iso}T00:00:00`);
  return d.toLocaleDateString("it-CH", { weekday: "short", day: "numeric", month: "short" });
}

function hhmm_da_min(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Impacchetta gli eventi sovrapposti di una colonna in sotto-colonne affiancate. */
function colonne_evento(eventi: EventoUnificato[]): { col: Record<string, number>; n_col: number } {
  const ordinati = [...eventi].sort((a, b) => a.inizio_min - b.inizio_min || a.fine_min - b.fine_min);
  const fine_col: number[] = [];
  const col: Record<string, number> = {};
  for (const e of ordinati) {
    let idx = fine_col.findIndex((f) => f <= e.inizio_min);
    if (idx === -1) {
      idx = fine_col.length;
      fine_col.push(e.fine_min);
    } else {
      fine_col[idx] = e.fine_min;
    }
    col[e.id] = idx;
  }
  return { col, n_col: Math.max(1, fine_col.length) };
}

const SettimanaView: React.FC<Props> = ({
  data_sel,
  includi_ospiti,
  on_cambia_data,
  on_apri_giorno,
  on_apri_planning,
}) => {
  const lunedi = useMemo(() => lunedi_di_iso(data_sel), [data_sel]);
  const domenica = useMemo(() => add_giorni(lunedi, 6), [lunedi]);
  const giorni = useMemo(() => Array.from({ length: 7 }, (_, i) => add_giorni(lunedi, i)), [lunedi]);

  const { eventi, risorse, is_loading } = use_eventi_unificati(lunedi, domenica);

  const risorse_visibili = useMemo(
    () =>
      risorse
        .filter((r) => r.attiva && (includi_ospiti || !r.is_ospite))
        .sort((a, b) => (a.tipo === b.tipo ? (a.ordine ?? 0) - (b.ordine ?? 0) : a.tipo === "ghiaccio" ? -1 : 1)),
    [risorse, includi_ospiti],
  );

  const orfani = useMemo(() => eventi.filter((e) => !e.risorsa_id), [eventi]);

  const finestra = useMemo(() => {
    if (eventi.length === 0) return { da: 8 * 60, a: 20 * 60 };
    const da = Math.min(...eventi.map((e) => e.inizio_min));
    const a = Math.max(...eventi.map((e) => e.fine_min));
    return {
      da: Math.max(0, Math.floor((da - 30) / 60) * 60),
      a: Math.min(24 * 60, Math.ceil((a + 30) / 60) * 60),
    };
  }, [eventi]);

  const altezza = (finestra.a - finestra.da) * PX_PER_MIN;
  const ore = useMemo(() => {
    const out: number[] = [];
    for (let m = finestra.da; m <= finestra.a; m += 60) out.push(m);
    return out;
  }, [finestra]);

  const oggi = new Date();
  const oggi_iso = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;

  const apri = (e: EventoUnificato) => {
    if (e.fonte === "griglia") on_apri_giorno(e.data);
    else on_apri_planning(e.data);
  };

  const griglia_risorsa = (risorsa_id: string | null, nome: string, tipo: "ghiaccio" | "palestra" | null, colore?: string | null) => {
    const eventi_risorsa = eventi.filter((e) => e.risorsa_id === risorsa_id);
    return (
      <div key={risorsa_id ?? "orfani"} className="rounded-xl border overflow-hidden">
        <div
          className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2"
          style={colore ? { borderLeft: `4px solid ${colore}` } : undefined}
        >
          {tipo === "ghiaccio" ? (
            <Snowflake className="h-4 w-4 text-sky-600" />
          ) : tipo === "palestra" ? (
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
          ) : (
            <HelpCircle className="h-4 w-4 text-amber-600" />
          )}
          <span className="text-sm font-semibold">{nome}</span>
          <span className="text-xs text-muted-foreground">
            {eventi_risorsa.length} {eventi_risorsa.length === 1 ? "voce" : "voci"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-[720px]">
            {/* gutter orari */}
            <div className="relative shrink-0 border-r bg-background" style={{ width: GUTTER_PX, height: altezza }}>
              {ore.map((m) => (
                <span
                  key={m}
                  className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: (m - finestra.da) * PX_PER_MIN }}
                >
                  {hhmm_da_min(m)}
                </span>
              ))}
            </div>

            {/* 7 colonne giorno */}
            {giorni.map((g) => {
              const del_giorno = eventi_risorsa.filter((e) => e.data === g);
              const { col, n_col } = colonne_evento(del_giorno);
              return (
                <div key={g} className="min-w-0 flex-1 border-r last:border-r-0">
                  <button
                    type="button"
                    onClick={() => on_apri_giorno(g)}
                    className={`block w-full border-b px-1 py-1 text-center text-[11px] capitalize hover:bg-muted ${
                      g === oggi_iso ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {label_giorno(g)}
                  </button>
                  <div className="relative bg-muted/20" style={{ height: altezza }}>
                    {ore.map((m) => (
                      <div
                        key={m}
                        className="absolute inset-x-0 border-t border-border/50"
                        style={{ top: (m - finestra.da) * PX_PER_MIN }}
                      />
                    ))}
                    {del_giorno.map((e) => {
                      const idx = col[e.id] ?? 0;
                      const top = (e.inizio_min - finestra.da) * PX_PER_MIN;
                      const h = Math.max(18, (e.fine_min - e.inizio_min) * PX_PER_MIN - 2);
                      return (
                        <EventoUnificatoBox
                          key={e.id}
                          evento={e}
                          onClick={() => apri(e)}
                          compatto={h < 34}
                          className="absolute"
                          style={{
                            top,
                            height: h,
                            left: `calc(${(idx / n_col) * 100}% + 2px)`,
                            width: `calc(${100 / n_col}% - 4px)`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => on_cambia_data(add_giorni(lunedi, -7))}>
          <ChevronLeft className="h-4 w-4" /> Settimana precedente
        </Button>
        <Button variant="outline" size="sm" onClick={() => on_cambia_data(oggi_iso)}>
          Oggi
        </Button>
        <Button variant="outline" size="sm" onClick={() => on_cambia_data(add_giorni(lunedi, 7))}>
          Settimana successiva <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {new Date(`${lunedi}T00:00:00`).toLocaleDateString("it-CH", { day: "numeric", month: "long" })} –{" "}
          {new Date(`${domenica}T00:00:00`).toLocaleDateString("it-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      {is_loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {risorse_visibili.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessuna risorsa attiva configurata.</p>
          )}
          {risorse_visibili.map((r) => griglia_risorsa(r.id, r.nome, r.tipo, r.colore))}
          {orfani.length > 0 && griglia_risorsa(null, "Non assegnata a una risorsa", null)}
        </div>
      )}
    </div>
  );
};

export default SettimanaView;
