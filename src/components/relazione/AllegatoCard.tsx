import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Upload } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cat_allegato, format_bytes } from "./categorie";
import { useTranslation } from "react-i18next";

interface Props {
  allegato: any;
  on_edit: () => void;
  on_delete: () => void;
}

export default function AllegatoCard({ allegato, on_edit, on_delete }: Props) {
  const { t } = useTranslation("dashboard");
  const cat = cat_allegato(allegato.categoria);
  const is_placeholder = (allegato.file_url ?? "").startsWith("placeholder://");

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center">
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={cat.color}>{cat.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {t("relazione.allegato_card.ordine", { ordine: allegato.ordine })}
            </span>
            {!allegato.stagione_id && (
              <Badge variant="outline" className="text-xs">{t("relazione.allegato_card.permanente")}</Badge>
            )}
            {is_placeholder && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                {t("relazione.allegato_card.placeholder")}
              </Badge>
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground">{allegato.titolo}</h3>
          {allegato.descrizione && (
            <p className="text-sm text-muted-foreground mt-0.5">{allegato.descrizione}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{format_bytes(allegato.file_size_bytes)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" variant="outline" onClick={on_edit} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />{t("relazione.allegato_card.sostituisci")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />{t("relazione.allegato_card.elimina")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("relazione.allegato_card.confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("relazione.allegato_card.confirm_desc", { titolo: allegato.titolo })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("relazione.allegato_card.annulla")}</AlertDialogCancel>
                <AlertDialogAction onClick={on_delete}>{t("relazione.allegato_card.elimina")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
