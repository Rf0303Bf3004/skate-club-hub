import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart3 } from "lucide-react";
import { use_griglia_blocchi_giorno, giorno_it_da_data } from "@/hooks/use-griglia-ghiaccio";
import { calcola_ore_impegnate_giorno } from "@/lib/availability";

type RisorsaMin = { id: string; nome: string; tipo: string };

type RigaDisp = { risorsa_id: string | null; ora_inizio: string; ora_fine: string };

function use_disponibilita_tutte(giorno_settimana: string) {
  const club_id = get_current_club_id();
  return useQuery({
    enabled: !!club_id && !!giorno_settimana,
    queryKey: ["disponibilita_giorno_tutte", club_id, giorno_settimana],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("disponibilita_ghiaccio")
        .select("risorsa_id,ora_inizio,ora_fine")
        .eq("club_id", club_id)
        .eq("giorno", giorno_settimana)
        .eq("tipo", "ghiaccio");
      if (error) throw error;
      return ((data ?? []) as RigaDisp[]);
    },
  });
}

function fmt_ore(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Mostra, per ogni risorsa attiva del giorno, quanta disponibilità dichiarata
 * è già occupata dalle sotto-sessioni della Griglia Ghiaccio.
 * Si aggiorna in automatico grazie alle query react-query già invalidate
 * dalle mutation della griglia.
 */
const DisponibilitaResiduaPopover: React.FC<{ data_sel: string; risorse: RisorsaMin[] }> = ({
  data_sel,
  risorse,
}) => {
  const giorno = giorno_it_da_data(data_sel);
  const { data: disponibilita = [] } = use_disponibilita_tutte(giorno);
  const { data: blocchi = [] } = use_griglia_blocchi_giorno(data_sel);

  const righe = useMemo(() => {
    return risorse.map((r) => {
      const fasce = disponibilita
        .filter((d) => d.risorsa_id === r.id)
        .map((d) => ({ ora_inizio: d.ora_inizio, ora_fine: d.ora_fine }));

      const slot: { ora_inizio: string; ora_fine: string }[] = [];
      for (const b of blocchi) {
        if ((b as any).risorsa_id !== r.id) continue;
        for (const s of (b as any).sessioni ?? []) {
          slot.push({ ora_inizio: s.ora_inizio, ora_fine: s.ora_fine });
        }
      }

      const { minuti_totali, minuti_impegnati, range_label } = calcola_ore_impegnate_giorno({
        fasce_disponibilita: fasce,
        slot_impegnati: slot,
      });
      const perc = minuti_totali > 0 ? Math.round((minuti_impegnati / minuti_totali) * 100) : 0;
      return {
        risorsa: r,
        minuti_totali,
        minuti_impegnati,
        minuti_liberi: Math.max(0, minuti_totali - minuti_impegnati),
        perc,
        range_label,
      };
    });
  }, [risorse, disponibilita, blocchi]);

  const colore = (perc: number) =>
    perc >= 95 ? "bg-red-500" : perc >= 75 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <BarChart3 className="w-4 h-4 mr-1" /> Disponibilità
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        <h4 className="text-sm font-semibold mb-1">Disponibilità residua</h4>
        <p className="text-xs text-muted-foreground mb-3 capitalize">{giorno}</p>
        {righe.length === 0 && (
          <p className="text-xs text-muted-foreground">Nessuna risorsa attiva per questo giorno.</p>
        )}
        <div className="space-y-3">
          {righe.map((r) => (
            <div key={r.risorsa.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium truncate">{r.risorsa.nome}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {r.minuti_totali === 0 ? "—" : `${r.perc}%`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${colore(r.perc)}`}
                  style={{ width: `${Math.min(100, r.perc)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {r.minuti_totali === 0
                  ? "Nessuna disponibilità dichiarata per questo giorno"
                  : `${fmt_ore(r.minuti_impegnati)} occupati su ${fmt_ore(r.minuti_totali)} · liberi ${fmt_ore(r.minuti_liberi)} (${r.range_label})`}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DisponibilitaResiduaPopover;
