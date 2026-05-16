import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileText, Upload } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cat_allegato, format_bytes } from "./categorie";

interface Props {
  allegato: any;
  on_edit: () => void;
  on_delete: () => void;
}

export default function AllegatoCard({ allegato, on_edit, on_delete }: Props) {
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
            <span className="text-xs text-muted-foreground">ordine {allegato.ordine}</span>
            {!allegato.stagione_id && <Badge variant="outline" className="text-xs">Permanente</Badge>}
            {is_placeholder && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Placeholder</Badge>}
          </div>
          <h3 className="text-base font-semibold text-foreground">{allegato.titolo}</h3>
          {allegato.descrizione && (
            <p className="text-sm text-muted-foreground mt-0.5">{allegato.descrizione}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{format_bytes(allegato.file_size_bytes)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" variant="outline" onClick={on_edit} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />Sostituisci / Modifica
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />Elimina
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare l'allegato?</AlertDialogTitle>
                <AlertDialogDescription>
                  Stai per eliminare "{allegato.titolo}". L'operazione e' irreversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={on_delete}>Elimina</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
