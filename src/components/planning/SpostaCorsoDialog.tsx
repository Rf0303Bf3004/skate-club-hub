import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Loader2, Move } from "lucide-react";
import { toast } from "sonner";

const format_data_it = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const GIORNI = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

interface Props {
  open: boolean;
  on_close: () => void;
  planning_corso: {
    id: string;
    corso_id: string;
    settimana_id: string;
    data: string;
    ora_inizio: string;
    ora_fine: string;
    istruttore_id: string | null;
    nome: string;
  };
  data_lunedi: string; // ISO YYYY-MM-DD
  istruttori: Array<{ id: string; nome: string; cognome: string }>;
  ghiaccio_slots: Array<{
    giorno: string;
    ora_inizio: string;
    ora_fine: string;
    tipo: string;
  }>;
  on_done: (
    new_planning_corso_id: string,
    original_id: string,
    new_data: string,
    new_ora_inizio: string,
  ) => void;
}

const SpostaCorsoDialog: React.FC<Props> = ({
  open,
  on_close,
  planning_corso,
  data_lunedi,
  istruttori,
  ghiaccio_slots,
  on_done,
}) => {
  const [giorno, set_giorno] = useState(GIORNI[0]);
  const [ora_inizio, set_ora_inizio] = useState(planning_corso.ora_inizio?.slice(0, 5) || "09:00");
  const [ora_fine, set_ora_fine] = useState(planning_corso.ora_fine?.slice(0, 5) || "10:00");
  const [istruttore_id, set_istruttore_id] = useState(
    planning_corso.istruttore_id || "",
  );
  const [saving, set_saving] = useState(false);

  // Calcola la data dal giorno della settimana
  const new_data = useMemo(() => {
    const idx = GIORNI.indexOf(giorno);
    const monday = new Date(`${data_lunedi}T00:00:00`);
    const target = new Date(monday);
    target.setDate(monday.getDate() + idx);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [giorno, data_lunedi]);

  // Fasce ghiaccio del giorno selezionato
  const slots_giorno = useMemo(
    () =>
      ghiaccio_slots
        .filter((s) => s.giorno === giorno && (s.tipo ?? "ghiaccio") === "ghiaccio")
        .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio)),
    [ghiaccio_slots, giorno],
  );

  const handle_save = async () => {
    if (!ora_inizio || !ora_fine || ora_fine <= ora_inizio) {
      toast.error("Orario non valido");
      return;
    }
    set_saving(true);
    try {
      const motivo_auto = `Spostato a ${new_data} ${ora_inizio}`;

      // 1. Annulla originale
      const { error: e1 } = await supabase
        .from("planning_corsi_settimana")
        .update({ annullato: true, motivo: motivo_auto })
        .eq("id", planning_corso.id);
      if (e1) throw e1;

      // 2. Crea nuovo record
      const { data: inserted, error: e2 } = await supabase
        .from("planning_corsi_settimana")
        .insert({
          settimana_id: planning_corso.settimana_id,
          corso_id: planning_corso.corso_id,
          data: new_data,
          ora_inizio,
          ora_fine,
          istruttore_id: istruttore_id || null,
          annullato: false,
          sostituisce_id: planning_corso.id,
          is_evento_extra: false,
        } as any)
        .select("id")
        .single();
      if (e2) throw e2;

      toast.success("Corso spostato");
      on_done(inserted.id, planning_corso.id, new_data, ora_inizio);
      on_close();
    } catch (e: any) {
      toast.error(e.message || "Errore durante lo spostamento");
    } finally {
      set_saving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && on_close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="h-4 w-4 text-primary" />
            Sposta corso in altro giorno/ora
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{planning_corso.nome}</span>
            <br />
            <span className="text-xs">
              Originale: {planning_corso.data} · {planning_corso.ora_inizio?.slice(0, 5)}–
              {planning_corso.ora_fine?.slice(0, 5)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Giorno</Label>
            <Select value={giorno} onValueChange={set_giorno}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GIORNI.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {slots_giorno.length > 0 && (
            <div className="rounded border border-border bg-muted/40 p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Fasce ghiaccio disponibili:
              </p>
              <div className="flex flex-wrap gap-1">
                {slots_giorno.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      set_ora_inizio(s.ora_inizio.slice(0, 5));
                      set_ora_fine(s.ora_fine.slice(0, 5));
                    }}
                    className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition"
                  >
                    {s.ora_inizio.slice(0, 5)}–{s.ora_fine.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ora inizio</Label>
              <Input type="time" value={ora_inizio} onChange={(e) => set_ora_inizio(e.target.value)} />
            </div>
            <div>
              <Label>Ora fine</Label>
              <Input type="time" value={ora_fine} onChange={(e) => set_ora_fine(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Istruttore</Label>
            <Select value={istruttore_id || "none"} onValueChange={(v) => set_istruttore_id(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Nessuno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuno</SelectItem>
                {istruttori.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} {i.cognome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground rounded border border-border bg-muted/30 p-2">
            <strong>Nuova data:</strong> {new_data} · {ora_inizio}–{ora_fine}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={on_close} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handle_save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Conferma spostamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SpostaCorsoDialog;
