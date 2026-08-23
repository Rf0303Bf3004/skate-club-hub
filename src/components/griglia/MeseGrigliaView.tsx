import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, Snowflake, Dumbbell, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { use_eventi_unificati, add_giorni, lunedi_di_iso, iso_da_date } from "@/hooks/use-planning-unificato";

interface Props {
  data_sel: string;
  includi_ospiti: boolean;
  on_cambia_data: (data_iso: string) => void;
  /** click su un giorno → vista Settimana */
  on_apri_settimana: (data_iso: string) => void;
  /** pulsante secondario → vista Giorno */
  on_apri_giorno: (data_iso: string) => void;
}

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const MeseGrigliaView: React.FC<Props> = ({
  data_sel,
  includi_ospiti,
  on_cambia_data,
  on_apri_settimana,
  on_apri_giorno,
}) => {
  const riferimento = useMemo(() => new Date(`${data_sel}T00:00:00`), [data_sel]);
  const primo_del_mese = useMemo(
    () => new Date(riferimento.getFullYear(), riferimento.getMonth(), 1),
    [riferimento],
  );
  const grid_start = useMemo(() => lunedi_di_iso(iso_da_date(primo_del_mese)), [primo_del_mese]);
  const grid_end = useMemo(() => add_giorni(grid_start, 41), [grid_start]);
  const giorni = useMemo(() => Array.from({ length: 42 }, (_, i) => add_giorni(grid_start, i)), [grid_start]);

  const { eventi, risorse, is_loading } = use_eventi_unificati(grid_start, grid_end);

  const risorse_map = useMemo(() => {
    const m = new Map<string, { nome: string; colore: string | null; tipo: string; visibile: boolean }>();
    risorse.forEach((r) =>
      m.set(r.id, {
        nome: r.nome,
        colore: r.colore,
        tipo: r.tipo,
        visibile: r.attiva && (includi_ospiti || !r.is_ospite),
      }),
    );
    return m;
  }, [risorse, includi_ospiti]);

  const per_giorno = useMemo(() => {
    const m = new Map<
      string,
      { ghiaccio: number; palestra: number; planning: number; risorse: Set<string> }
    >();
    eventi.forEach((e) => {
      if (e.annullato) return;
      if (e.risorsa_id && risorse_map.get(e.risorsa_id)?.visibile === false) return;
      const cur = m.get(e.data) ?? { ghiaccio: 0, palestra: 0, planning: 0, risorse: new Set<string>() };
      if (e.tipo_risorsa === "palestra") cur.palestra += 1;
      else cur.ghiaccio += 1;
      if (e.fonte === "planning") cur.planning += 1;
      if (e.risorsa_id) cur.risorse.add(e.risorsa_id);
      m.set(e.data, cur);
    });
    return m;
  }, [eventi, risorse_map]);

  const mese_corrente = riferimento.getMonth();
  const oggi_iso = iso_da_date(new Date());

  const vai_mese = (delta: number) => {
    const d = new Date(riferimento.getFullYear(), riferimento.getMonth() + delta, 1);
    on_cambia_data(iso_da_date(d));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => vai_mese(-1)}>
          <ChevronLeft className="h-4 w-4" /> Mese precedente
        </Button>
        <Button variant="outline" size="sm" onClick={() => on_cambia_data(oggi_iso)}>
          Oggi
        </Button>
        <Button variant="outline" size="sm" onClick={() => vai_mese(1)}>
          Mese successivo <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">
          {riferimento.toLocaleDateString("it-CH", { month: "long", year: "numeric" })}
        </span>
      </div>

      {is_loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {GIORNI.map((g) => (
              <div key={g} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
                {g}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {giorni.map((g) => {
              const cell = per_giorno.get(g);
              const d = new Date(`${g}T00:00:00`);
              const fuori_mese = d.getMonth() !== mese_corrente;
              return (
                <div
                  key={g}
                  className={`min-h-[92px] border-b border-r p-1.5 text-xs ${
                    fuori_mese ? "bg-muted/30 text-muted-foreground" : ""
                  } ${g === oggi_iso ? "ring-1 ring-inset ring-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="rounded px-1 font-semibold hover:bg-muted"
                      onClick={() => on_apri_settimana(g)}
                      title="Apri la settimana"
                    >
                      {d.getDate()}
                    </button>
                    <button
                      type="button"
                      className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted"
                      onClick={() => on_apri_giorno(g)}
                      title="Apri il giorno"
                    >
                      giorno
                    </button>
                  </div>

                  {cell && (
                    <div className="mt-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {cell.ghiaccio > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-sky-700">
                            <Snowflake className="h-3 w-3" />
                            {cell.ghiaccio}
                          </span>
                        )}
                        {cell.palestra > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                            <Dumbbell className="h-3 w-3" />
                            {cell.palestra}
                          </span>
                        )}
                        {cell.planning > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 text-muted-foreground"
                            title="Occorrenze del Planning classico (sola lettura)"
                          >
                            <Lock className="h-3 w-3" />
                            {cell.planning}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(cell.risorse).map((rid) => (
                          <span
                            key={rid}
                            title={risorse_map.get(rid)?.nome ?? ""}
                            className="inline-block h-2 w-2 rounded-full border border-border"
                            style={{ backgroundColor: risorse_map.get(rid)?.colore || "hsl(var(--primary))" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeseGrigliaView;
