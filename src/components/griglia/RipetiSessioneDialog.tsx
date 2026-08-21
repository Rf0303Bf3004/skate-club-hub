import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { format_local_iso } from "@/lib/planning-occorrenze";
import { Repeat, CalendarRange, CalendarDays } from "lucide-react";

interface Props {
  open: boolean;
  on_close: () => void;
  giorno: string;
  data_blocco: string;
  gia_ricorrente: boolean;
  in_corso?: boolean;
  on_conferma: (fino_a: string) => void;
}

/** Ultima occorrenza dello stesso giorno-settimana entro `limite`. */
function ultima_occorrenza(data_blocco: string, limite: string): string {
  const cursore = new Date(`${data_blocco}T00:00:00`);
  const fine = new Date(`${limite}T00:00:00`);
  let ultima = new Date(cursore);
  while (cursore <= fine) {
    ultima = new Date(cursore);
    cursore.setDate(cursore.getDate() + 7);
  }
  return format_local_iso(ultima);
}

const RipetiSessioneDialog: React.FC<Props> = ({
  open,
  on_close,
  giorno,
  data_blocco,
  gia_ricorrente,
  in_corso,
  on_conferma,
}) => {
  const [n_settimane, set_n_settimane] = useState(8);
  const [fine_stagione, set_fine_stagione] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const club_id = get_current_club_id();
    if (!club_id) return;
    (async () => {
      const { data } = await supabase
        .from("stagioni")
        .select("data_fine,attiva,data_inizio")
        .eq("club_id", club_id)
        .order("data_inizio", { ascending: false });
      const lista = (data ?? []) as any[];
      const st = lista.find((s) => s.attiva) ?? lista[0] ?? null;
      set_fine_stagione(st?.data_fine ?? null);
    })();
  }, [open]);

  const data_fine_n = useMemo(() => {
    const d = new Date(`${data_blocco}T00:00:00`);
    d.setDate(d.getDate() + 7 * Math.max(1, Math.min(52, n_settimane)));
    return format_local_iso(d);
  }, [data_blocco, n_settimane]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && on_close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-4 h-4" /> Ripeti questa sessione
          </DialogTitle>
          <DialogDescription>
            {gia_ricorrente
              ? "La sessione è già ricorrente: puoi estenderne la durata, non verranno creati duplicati."
              : `Genera automaticamente la stessa sessione ogni ${giorno}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            disabled={in_corso}
            onClick={on_close}
          >
            <CalendarDays className="w-4 h-4 mr-3 shrink-0" />
            <span className="text-left">
              <span className="block font-medium">Solo oggi</span>
              <span className="block text-xs text-muted-foreground">Nessuna ricorrenza, resta una sessione singola</span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            disabled={in_corso || !fine_stagione}
            onClick={() => fine_stagione && on_conferma(ultima_occorrenza(data_blocco, fine_stagione))}
          >
            <CalendarRange className="w-4 h-4 mr-3 shrink-0" />
            <span className="text-left">
              <span className="block font-medium">Ogni {giorno} fino a fine stagione</span>
              <span className="block text-xs text-muted-foreground">
                {fine_stagione
                  ? `Ultima occorrenza entro il ${new Date(`${fine_stagione}T00:00:00`).toLocaleDateString("it-CH")}`
                  : "Nessuna stagione attiva configurata"}
              </span>
            </span>
          </Button>

          <div className="rounded-lg border p-3 space-y-2">
            <Label className="text-sm font-medium">Ogni {giorno} per N settimane</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={52}
                value={n_settimane}
                onChange={(e) => set_n_settimane(Number(e.target.value) || 1)}
                className="h-9 w-24"
              />
              <Button
                className="flex-1"
                disabled={in_corso}
                onClick={() => on_conferma(data_fine_n)}
              >
                {in_corso ? "Generazione…" : "Genera ricorrenza"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ultima occorrenza: {new Date(`${data_fine_n}T00:00:00`).toLocaleDateString("it-CH")}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RipetiSessioneDialog;
