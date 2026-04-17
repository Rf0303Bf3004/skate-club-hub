import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  on_close: () => void;
  planning_corso_id: string;
  corso_nome: string;
  giorno: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  on_done: (planning_corso_id: string, motivo: string) => void;
}

const AnnullaCorsoDialog: React.FC<Props> = ({
  open,
  on_close,
  planning_corso_id,
  corso_nome,
  giorno,
  data,
  ora_inizio,
  ora_fine,
  on_done,
}) => {
  const [motivo, set_motivo] = useState("");
  const [saving, set_saving] = useState(false);

  const handle_save = async () => {
    if (!motivo.trim()) {
      toast.error("Il motivo è obbligatorio");
      return;
    }
    set_saving(true);
    try {
      const { error } = await supabase
        .from("planning_corsi_settimana")
        .update({ annullato: true, motivo: motivo.trim() })
        .eq("id", planning_corso_id);
      if (error) throw error;
      toast.success("Corso annullato per questa settimana");
      on_done(planning_corso_id, motivo.trim());
      set_motivo("");
      on_close();
    } catch (e: any) {
      toast.error(e.message || "Errore durante l'annullamento");
    } finally {
      set_saving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && on_close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-destructive" />
            Annulla corso (solo questa settimana)
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{corso_nome}</span>
            <br />
            {giorno} {data} · {ora_inizio?.slice(0, 5)}–{ora_fine?.slice(0, 5)}
            <br />
            <span className="text-xs">
              L'annullamento vale solo per questa occorrenza. Il corso ricorrente
              non verrà modificato.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo dell'annullamento *</Label>
          <Textarea
            id="motivo"
            placeholder="Es. Pista chiusa per manutenzione, malattia istruttore..."
            value={motivo}
            onChange={(e) => set_motivo(e.target.value)}
            rows={4}
            disabled={saving}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={on_close} disabled={saving}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            onClick={handle_save}
            disabled={saving || !motivo.trim()}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Conferma annullamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnullaCorsoDialog;
