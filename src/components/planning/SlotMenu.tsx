import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Info, Move, Ban, Megaphone, Pencil, Trash2 } from "lucide-react";

export interface SlotMenuAzioni {
  on_dettagli?: () => void;
  on_modifica?: () => void;
  on_sposta?: () => void;
  on_annulla?: () => void;
  on_avvisa?: () => void;
  on_rimuovi?: () => void;
}

/**
 * Menu contestuale unico per un blocco del planning.
 * Mostra SOLO le azioni pertinenti allo slot: le voci non applicabili
 * non vengono renderizzate (niente pulsanti spenti).
 * Il click normale resta invariato (apre il pannello dettagli).
 */
export const SlotMenu: React.FC<
  SlotMenuAzioni & { titolo: string; sottotitolo?: string; children: React.ReactNode }
> = ({ titolo, sottotitolo, children, on_dettagli, on_modifica, on_sposta, on_annulla, on_avvisa, on_rimuovi }) => {
  const voci = [
    { key: "dettagli", label: "Dettagli", icon: Info, fn: on_dettagli },
    { key: "modifica", label: "Modifica corso", icon: Pencil, fn: on_modifica },
    { key: "sposta", label: "Sposta", icon: Move, fn: on_sposta },
    { key: "annulla", label: "Annulla lezione", icon: Ban, fn: on_annulla },
    { key: "avvisa", label: "Avvisa atleti", icon: Megaphone, fn: on_avvisa },
  ].filter((v) => !!v.fn);

  if (voci.length === 0 && !on_rimuovi) return <>{children}</>;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate">
          {titolo}
          {sottotitolo && <span className="block text-[11px] font-normal text-muted-foreground">{sottotitolo}</span>}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        {voci.map((v) => {
          const Icon = v.icon;
          return (
            <ContextMenuItem key={v.key} onSelect={() => v.fn?.()} className="gap-2">
              <Icon className="h-4 w-4" />
              {v.label}
            </ContextMenuItem>
          );
        })}
        {on_rimuovi && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => on_rimuovi()} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" />
              Togli dal planning
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default SlotMenu;
