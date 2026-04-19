import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MESI_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const GIORNI_LABEL = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

interface MeseViewProps {
  club_id: string | null;
  stagione_id: string | null;
  current_month: Date; // primo del mese visualizzato
  istruttori: any[];
  on_click_giorno: (data_iso: string) => void;
}

interface DayCellAggregato {
  num_corsi: number;
  istruttori_ids: string[]; // unique
  has_annullati: boolean;
  has_eccezioni: boolean; // sostituzioni o eventi extra
}

const MeseView: React.FC<MeseViewProps> = ({ club_id, stagione_id, current_month, istruttori, on_click_giorno }) => {
  // Calcola griglia: parte dal lunedì che contiene/precede il primo del mese
  const grid_start = useMemo(() => {
    const first_day = new Date(current_month.getFullYear(), current_month.getMonth(), 1);
    return getMondayOfWeek(first_day);
  }, [current_month]);

  const grid_end = useMemo(() => {
    // Mostra 6 settimane (42 giorni) = griglia standard mese
    return addDays(grid_start, 42);
  }, [grid_start]);

  // Query: tutti i planning_corsi_settimana del mese
  const { data: slot_mese = [], isLoading } = useQuery({
    queryKey: ["planning_mese", club_id, stagione_id, formatDateISO(grid_start), formatDateISO(grid_end)],
    enabled: !!club_id,
    queryFn: async () => {
      // 1. Trova le settimane comprese
      const { data: settimane } = await supabase
        .from("planning_settimane")
        .select("id, data_lunedi")
        .eq("club_id", club_id!)
        .gte("data_lunedi", formatDateISO(addDays(grid_start, -7)))
        .lte("data_lunedi", formatDateISO(grid_end));

      const settimane_ids = (settimane ?? []).map((s) => s.id);
      if (settimane_ids.length === 0) return [];

      const { data: slots } = await supabase
        .from("planning_corsi_settimana")
        .select("id, data, istruttore_id, annullato, sostituisce_id, is_evento_extra")
        .in("settimana_id", settimane_ids)
        .gte("data", formatDateISO(grid_start))
        .lt("data", formatDateISO(grid_end));

      return slots ?? [];
    },
  });

  // Aggrega per giorno
  const map_giorno = useMemo(() => {
    const map = new Map<string, DayCellAggregato>();
    slot_mese.forEach((s: any) => {
      const key = s.data;
      if (!map.has(key)) {
        map.set(key, { num_corsi: 0, istruttori_ids: [], has_annullati: false, has_eccezioni: false });
      }
      const cell = map.get(key)!;
      if (s.annullato) {
        cell.has_annullati = true;
      } else {
        cell.num_corsi += 1;
        if (s.istruttore_id && !cell.istruttori_ids.includes(s.istruttore_id)) {
          cell.istruttori_ids.push(s.istruttore_id);
        }
      }
      if (s.sostituisce_id || s.is_evento_extra) cell.has_eccezioni = true;
    });
    return map;
  }, [slot_mese]);

  const istr_map = useMemo(() => {
    const m = new Map<string, any>();
    istruttori.forEach((i) => m.set(i.id, i));
    return m;
  }, [istruttori]);

  // Costruisci 6 settimane × 7 giorni
  const settimane_render = useMemo(() => {
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(addDays(grid_start, w * 7 + d));
      }
      weeks.push(week);
    }
    return weeks;
  }, [grid_start]);

  const today_iso = formatDateISO(new Date());
  const current_month_idx = current_month.getMonth();

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header giorni settimana */}
      <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
        {GIORNI_LABEL.map((g) => (
          <div key={g} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center">
            {g}
          </div>
        ))}
      </div>

      {/* Griglia mese */}
      <div className="grid grid-cols-7">
        {settimane_render.flat().map((data, idx) => {
          const data_iso = formatDateISO(data);
          const is_other_month = data.getMonth() !== current_month_idx;
          const is_today = data_iso === today_iso;
          const cell = map_giorno.get(data_iso);
          const istr_visible = (cell?.istruttori_ids ?? []).slice(0, 5);
          const istr_extra = (cell?.istruttori_ids?.length ?? 0) - istr_visible.length;
          const is_last_row = idx >= 35;

          return (
            <button
              key={data_iso}
              type="button"
              onClick={() => on_click_giorno(data_iso)}
              className={`relative min-h-[90px] text-left p-1.5 border-r border-b border-border last:border-r-0 hover:bg-muted/40 transition-colors flex flex-col ${
                is_other_month ? "bg-muted/20 text-muted-foreground" : "bg-card text-foreground"
              } ${is_last_row ? "border-b-0" : ""} ${
                (idx + 1) % 7 === 0 ? "border-r-0" : ""
              }`}
            >
              {/* Header cella: numero giorno + icone allarme */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold inline-flex items-center justify-center rounded-full ${
                    is_today
                      ? "bg-primary text-primary-foreground w-5 h-5"
                      : ""
                  }`}
                >
                  {data.getDate()}
                </span>
                <div className="flex items-center gap-0.5">
                  {cell?.has_annullati && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>Annullamenti presenti</TooltipContent>
                    </Tooltip>
                  )}
                  {cell?.has_eccezioni && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Pencil className="h-3 w-3 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent>Eccezioni o eventi extra</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Numero corsi */}
              {cell && cell.num_corsi > 0 && (
                <div className="text-[10px] text-muted-foreground mb-1">
                  {cell.num_corsi} cors{cell.num_corsi === 1 ? "o" : "i"}
                </div>
              )}

              {/* Pallini istruttori (max 5 + N) */}
              {istr_visible.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {istr_visible.map((id) => {
                    const istr = istr_map.get(id);
                    const colore = istr?.colore ?? "#9CA3AF";
                    const nome_completo = istr ? `${istr.nome} ${istr.cognome}`.trim() : "Istruttore";
                    return (
                      <Tooltip key={id}>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-block w-2 h-2 rounded-full border border-card"
                            style={{ backgroundColor: colore }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>{nome_completo}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {istr_extra > 0 && (
                    <span className="text-[9px] font-semibold text-muted-foreground leading-none ml-0.5">
                      +{istr_extra}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
          Caricamento dati mensili…
        </div>
      )}
    </div>
  );
};

export default MeseView;
