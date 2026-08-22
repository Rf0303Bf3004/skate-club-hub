import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cat_blocco } from "./categorie";
import { useTranslation } from "react-i18next";

interface Props {
  blocco: any;
  on_toggle: (attivo: boolean) => void;
  on_edit: () => void;
  on_delete: () => void;
}

export default function BloccoCard({ blocco, on_toggle, on_edit, on_delete }: Props) {
  const { t } = useTranslation("dashboard");
  const cat = cat_blocco(blocco.categoria);
  const preview = (blocco.contenuto ?? "").slice(0, 200);
  const truncated = (blocco.contenuto ?? "").length > 200;

  return (
    <Card className={`p-4 ${blocco.attivo ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cat.color}>{cat.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {t("relazione.blocco_card.ordine", { ordine: blocco.ordine })}
            </span>
            {!blocco.stagione_id && (
              <Badge variant="outline" className="text-xs">{t("relazione.blocco_card.permanente")}</Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold text-foreground">{blocco.titolo}</h3>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {preview}{truncated && "..."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={blocco.attivo} onCheckedChange={on_toggle} />
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={on_edit} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />{t("relazione.blocco_card.modifica")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("relazione.blocco_card.confirm_title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("relazione.blocco_card.confirm_desc", { titolo: blocco.titolo })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("relazione.blocco_card.annulla")}</AlertDialogCancel>
                  <AlertDialogAction onClick={on_delete}>{t("relazione.blocco_card.elimina")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Card>
  );
}
