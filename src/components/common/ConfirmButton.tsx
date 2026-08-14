import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  titolo: string;
  descrizione?: string;
  conferma_label?: string;
  on_conferma: () => void;
  children: React.ReactNode;
}

/**
 * Conferma coerente con lo stile dell'app (niente popup nativi del browser,
 * poco leggibili e scomodi al tocco su iPad).
 */
const ConfirmButton: React.FC<Props> = ({
  titolo,
  descrizione,
  conferma_label = "Elimina",
  on_conferma,
  children,
}) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{titolo}</AlertDialogTitle>
        {descrizione && <AlertDialogDescription>{descrizione}</AlertDialogDescription>}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annulla</AlertDialogCancel>
        <AlertDialogAction
          onClick={on_conferma}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {conferma_label}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmButton;
