import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * Mostra SOLO le azioni pertinenti allo slot.
 * Apertura: click/tap sinistro (touch-friendly, iPad) oppure click destro (scorciatoia mouse).
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

  const header = (
    <>
      {titolo}
      {sottotitolo && <span className="block text-[11px] font-normal text-muted-foreground">{sottotitolo}</span>}
    </>
  );

  const content_class = "w-56 max-w-[calc(100vw-1.5rem)]";

  return (
    <DropdownMenu>
      <ContextMenu>
        <DropdownMenuTrigger asChild>
          <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        </DropdownMenuTrigger>

        <ContextMenuContent className={content_class}>
          <ContextMenuLabel className="truncate">{header}</ContextMenuLabel>
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

      <DropdownMenuContent align="start" collisionPadding={8} className={content_class}>
        <DropdownMenuLabel className="truncate">{header}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {voci.map((v) => {
          const Icon = v.icon;
          return (
            <DropdownMenuItem key={v.key} onSelect={() => v.fn?.()} className="gap-2">
              <Icon className="h-4 w-4" />
              {v.label}
            </DropdownMenuItem>
          );
        })}
        {on_rimuovi && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => on_rimuovi()} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" />
              Togli dal planning
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SlotMenu;
