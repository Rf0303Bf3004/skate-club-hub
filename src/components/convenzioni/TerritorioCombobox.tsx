import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type OpzioneTerritorio = { id: string; nome: string };

interface Props {
  value: string | null;
  options: OpzioneTerritorio[];
  placeholder: string;
  empty_label?: string;
  disabled?: boolean;
  on_select: (id: string | null) => void;
  /** Crea un nuovo record e restituisce il suo id. */
  on_create?: (nome: string) => Promise<string>;
}

/**
 * Combobox ricercabile con creazione al volo del valore digitato.
 */
export function TerritorioCombobox({
  value,
  options,
  placeholder,
  empty_label = "Nessun risultato",
  disabled = false,
  on_select,
  on_create,
}: Props) {
  const [open, set_open] = useState(false);
  const [query, set_query] = useState("");
  const [creating, set_creating] = useState(false);

  const selected = options.find((o) => o.id === value) ?? null;
  const q = query.trim();
  const esiste_gia = options.some((o) => o.nome.toLowerCase() === q.toLowerCase());

  const handle_create = async () => {
    if (!on_create || !q || creating) return;
    set_creating(true);
    try {
      const id = await on_create(q);
      on_select(id);
      set_query("");
      set_open(false);
    } finally {
      set_creating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { set_open(o); if (!o) set_query(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected?.nome ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Cerca o digita per creare…"
            value={query}
            onValueChange={set_query}
            className="h-11"
          />
          <CommandList className="max-h-64">
            <CommandEmpty>
              {q && on_create ? (
                <button
                  type="button"
                  onClick={handle_create}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent rounded-md"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crea «{q}»
                </button>
              ) : (
                <span className="block px-3 py-4 text-sm text-muted-foreground text-center">{empty_label}</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__reset__"
                  onSelect={() => { on_select(null); set_open(false); }}
                  className="text-muted-foreground"
                >
                  — Nessuna selezione —
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.nome}
                  onSelect={() => { on_select(o.id); set_open(false); set_query(""); }}
                  className="min-h-[2.5rem]"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  {o.nome}
                </CommandItem>
              ))}
            </CommandGroup>
            {q && on_create && !esiste_gia && (
              <CommandGroup className="border-t border-border">
                <CommandItem value={`__crea__${q}`} onSelect={handle_create} className="min-h-[2.5rem]">
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Crea «{q}»
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Selettore stelle 1-5 cliccabile. */
export function StelleSelector({
  value,
  on_change,
}: {
  value: number | null;
  on_change: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 h-10">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} stelle`}
          onClick={() => on_change(value === n ? null : n)}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className={cn(
              "w-6 h-6",
              (value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground",
            )}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9z" />
          </svg>
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          onClick={() => on_change(null)}
          className="ml-2 text-xs text-muted-foreground hover:underline"
        >
          azzera
        </button>
      )}
    </div>
  );
}
