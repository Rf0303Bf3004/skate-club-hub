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
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface Props {
  open: boolean;
  on_close: () => void;
  planning_corso_id: string;
  corso_id_originale?: string;
  settimana_id?: string;
  ora_inizio_orig?: string;
  ora_fine_orig?: string;
  istruttore_id?: string | null;
  corso_nome: string;
  giorno: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  on_done: (planning_corso_id: string, motivo: string) => void;
}

const format_data_it = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const tk = (k: string, o?: any) => i18n.t(`annulla_dialog.${k}`, { ns: "planning", ...(o || {}) }) as string;

const AnnullaCorsoDialog: React.FC<Props> = ({
  open,
  on_close,
  planning_corso_id,
  corso_id_originale,
  settimana_id,
  ora_inizio_orig,
  ora_fine_orig,
  istruttore_id,
  corso_nome,
  giorno,
  data,
  ora_inizio,
  ora_fine,
  on_done,
}) => {
  const { t } = useTranslation("planning");
  const [motivo, set_motivo] = useState("");
  const [saving, set_saving] = useState(false);

  const handle_save = async () => {
    if (!motivo.trim()) {
      toast.error(tk("err_motivo"));
      return;
    }
    if (!settimana_id) {
      toast.error(tk("err_settimana"));
      return;
    }
    const corso_id_target = corso_id_originale || planning_corso_id;
    if (!corso_id_target) {
      toast.error(tk("err_corso_id"));
      return;
    }
    set_saving(true);
    try {
      const { data: auth_data } = await supabase.auth.getUser();
      const user_id = auth_data?.user?.id ?? null;

      // 1) SELECT esistente
      const { data: existing, error: sel_err } = await supabase
        .from("planning_corsi_settimana")
        .select("id")
        .eq("settimana_id", settimana_id)
        .eq("data", data)
        .or(`corso_id.eq.${corso_id_target},sostituisce_id.eq.${corso_id_target}`)
        .limit(1)
        .maybeSingle();
      if (sel_err) throw sel_err;

      let final_id: string;

      if (existing?.id) {
        // 2a) UPDATE
        const { data: upd, error: upd_err } = await supabase
          .from("planning_corsi_settimana")
          .update({ annullato: true, motivo: motivo.trim() })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (upd_err) throw upd_err;
        final_id = upd.id;
      } else {
        // 2b) INSERT
        const { data: ins, error: ins_err } = await supabase
          .from("planning_corsi_settimana")
          .insert({
            settimana_id,
            corso_id: corso_id_target,
            sostituisce_id: corso_id_target,
            data,
            ora_inizio: ora_inizio_orig || ora_inizio,
            ora_fine: ora_fine_orig || ora_fine,
            istruttore_id: istruttore_id ?? null,
            is_evento_extra: false,
            annullato: true,
            motivo: motivo.trim(),
            creato_da: user_id,
          })
          .select("id")
          .single();
        if (ins_err) throw ins_err;
        final_id = ins.id;
      }

      // 3) Conta iscritti e crea comunicazione
      try {
        const { count } = await supabase
          .from("iscrizioni_corsi")
          .select("id", { count: "exact", head: true })
          .eq("corso_id", corso_id_target)
          .eq("attiva", true);

        if ((count ?? 0) > 0) {
          const club_id = await get_current_club_id();
          if (club_id) {
            const data_it = format_data_it(data);
            const testo = tk("com_testo", { corso: corso_nome, data: data_it, motivo: motivo.trim(), interpolation: { escapeValue: false } });
            const { error: com_err } = await supabase.from("comunicazioni").insert({
              club_id,
              titolo: tk("com_titolo"),
              testo,
              tipo: "corso_annullato",
              tipo_destinatari: "per_corso",
              planning_corso_id: final_id,
              corso_id: corso_id_target,
              stato: "pending",
              programmata_per: new Date().toISOString(),
              creata_da: user_id,
            });
            if (com_err) console.error("[AnnullaCorsoDialog] comunicazione error", com_err);
          }
        }
      } catch (com_e) {
        console.error("[AnnullaCorsoDialog] errore creazione comunicazione", com_e);
      }

      toast.success(tk("ok"));
      on_done(final_id, motivo.trim());
      set_motivo("");
      on_close();
    } catch (e: any) {
      console.error("[AnnullaCorsoDialog] errore handle_save", e);
      toast.error(e.message || tk("err_generico"));
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
            {t("annulla_dialog.titolo")}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{corso_nome}</span>
            <br />
            {giorno} {data} · {ora_inizio?.slice(0, 5)}–{ora_fine?.slice(0, 5)}
            <br />
            <span className="text-xs">
              {t("annulla_dialog.nota")}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo">{t("annulla_dialog.motivo_label")}</Label>
          <Textarea
            id="motivo"
            placeholder={t("annulla_dialog.motivo_placeholder")}
            value={motivo}
            onChange={(e) => set_motivo(e.target.value)}
            rows={4}
            disabled={saving}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={on_close} disabled={saving}>
            {t("annulla_dialog.annulla")}
          </Button>
          <Button
            variant="destructive"
            onClick={handle_save}
            disabled={saving || !motivo.trim()}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t("annulla_dialog.conferma")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnullaCorsoDialog;
