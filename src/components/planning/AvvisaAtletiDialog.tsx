import React, { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Loader2, Send, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type TipoEccezione = "annullamento" | "spostamento";

interface Props {
  open: boolean;
  on_close: () => void;
  tipo: TipoEccezione;
  /** id del record planning_corsi_settimana annullato (anche per spostamento: l'originale) */
  planning_corso_id: string;
  /** info per il messaggio */
  contesto: {
    corso_nome: string;
    giorno: string;
    data: string;
    ora_inizio: string;
    ora_fine: string;
    motivo?: string;
    nuova_data?: string;
    nuova_ora?: string;
  };
}

const AvvisaAtletiDialog: React.FC<Props> = ({
  open,
  on_close,
  tipo,
  planning_corso_id,
  contesto,
}) => {
  const [atleti_impattati, set_atleti_impattati] = useState<
    Array<{ atleta_id: string; nome: string; cognome: string; telefono: string | null }>
  >([]);
  const [loading_atleti, set_loading_atleti] = useState(true);
  const [titolo, set_titolo] = useState("");
  const [corpo, set_corpo] = useState("");
  const [saving, set_saving] = useState(false);
  const [scheduling, set_scheduling] = useState(false);
  const [programmata_per, set_programmata_per] = useState("");

  // Genera testo di default
  useEffect(() => {
    if (!open) return;
    if (tipo === "annullamento") {
      set_titolo("🔴 Corso annullato");
      set_corpo(
        `🔴 Corso annullato — ${contesto.giorno} ${contesto.data} ${contesto.ora_inizio?.slice(
          0,
          5,
        )}.${contesto.motivo ? ` Motivo: ${contesto.motivo}` : ""}`,
      );
    } else {
      set_titolo("🔄 Corso spostato");
      set_corpo(
        `🔄 Corso spostato — da ${contesto.data} ${contesto.ora_inizio?.slice(0, 5)} a ${
          contesto.nuova_data || "?"
        } ${contesto.nuova_ora || "?"}`,
      );
    }
  }, [open, tipo, contesto]);

  // Carica atleti impattati
  useEffect(() => {
    if (!open || !planning_corso_id) return;
    set_loading_atleti(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "get_atleti_impattati_da_planning" as any,
          { p_planning_corso_id: planning_corso_id },
        );
        if (error) throw error;
        set_atleti_impattati((data ?? []) as any);
      } catch (e: any) {
        console.error(e);
        toast.error("Impossibile caricare gli atleti impattati");
        set_atleti_impattati([]);
      } finally {
        set_loading_atleti(false);
      }
    })();
  }, [open, planning_corso_id]);

  const invia = async (programmata?: string) => {
    if (!titolo.trim() || !corpo.trim()) {
      toast.error("Titolo e messaggio sono obbligatori");
      return;
    }
    const club_id = await get_current_club_id();
    if (!club_id) {
      toast.error("Club non disponibile");
      return;
    }
    set_saving(true);
    try {
      const payload: any = {
        club_id,
        titolo: titolo.trim(),
        testo: corpo.trim(),
        tipo,
        planning_corso_id,
        deep_link: "iceapp://atleta/calendario",
        stato: "pending",
        tipo_destinatari: "per_corso",
        programmata_per: programmata || new Date().toISOString(),
      };
      const { error } = await supabase.from("comunicazioni").insert(payload);
      if (error) throw error;
      toast.success(
        programmata
          ? "Comunicazione pianificata"
          : `Comunicazione creata (${atleti_impattati.length} destinatari)`,
      );
      on_close();
    } catch (e: any) {
      toast.error(e.message || "Errore creazione comunicazione");
    } finally {
      set_saving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && on_close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Comunicazione atleti coinvolti
          </DialogTitle>
          <DialogDescription>
            Invia o pianifica una notifica push agli atleti impattati.
          </DialogDescription>
        </DialogHeader>

        {/* Atleti impattati */}
        <div>
          <Label className="text-xs text-muted-foreground">
            Atleti impattati ({atleti_impattati.length})
          </Label>
          <div className="mt-1 max-h-32 overflow-y-auto rounded border border-border bg-muted/30 p-2">
            {loading_atleti ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Caricamento...
              </div>
            ) : atleti_impattati.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nessun atleta iscritto al corso.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {atleti_impattati.map((a) => (
                  <Badge key={a.atleta_id} variant="secondary" className="text-xs">
                    {a.nome} {a.cognome}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <Label>Titolo</Label>
          <Input value={titolo} onChange={(e) => set_titolo(e.target.value)} />
        </div>

        <div>
          <Label>Messaggio (anteprima push)</Label>
          <Textarea
            value={corpo}
            onChange={(e) => set_corpo(e.target.value)}
            rows={4}
          />
        </div>

        {scheduling && (
          <div>
            <Label>Pianifica per</Label>
            <Input
              type="datetime-local"
              value={programmata_per}
              onChange={(e) => set_programmata_per(e.target.value)}
            />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={on_close} disabled={saving}>
            Annulla
          </Button>
          {!scheduling ? (
            <>
              <Button
                variant="outline"
                onClick={() => set_scheduling(true)}
                disabled={saving}
                className="gap-1.5"
              >
                <Clock className="h-4 w-4" /> Pianifica invio…
              </Button>
              <Button onClick={() => invia()} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Invia subito
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                if (!programmata_per) {
                  toast.error("Imposta la data di invio");
                  return;
                }
                invia(new Date(programmata_per).toISOString());
              }}
              disabled={saving || !programmata_per}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Pianifica
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvvisaAtletiDialog;
