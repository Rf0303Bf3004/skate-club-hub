import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageSquare, CreditCard, Trophy, Calendar, UserCheck } from "lucide-react";

interface Props {
  open: boolean;
  on_open_change: (o: boolean) => void;
}

type Hit = {
  id: string;
  label: string;
  sub?: string;
  category: "atleti" | "comunicazioni" | "fatture" | "gare" | "eventi" | "istruttori";
  route: string;
};

const CATEGORY_META: Record<Hit["category"], { label: string; Icon: any }> = {
  atleti: { label: "Atleti", Icon: Users },
  comunicazioni: { label: "Comunicazioni", Icon: MessageSquare },
  fatture: { label: "Fatture", Icon: CreditCard },
  gare: { label: "Gare", Icon: Trophy },
  eventi: { label: "Eventi", Icon: Calendar },
  istruttori: { label: "Istruttori", Icon: UserCheck },
};

const GlobalSearchPalette: React.FC<Props> = ({ open, on_open_change }) => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [q, set_q] = React.useState("");
  const debounced = useDebouncedValue(q, 200);
  const club_id = session?.club_id;

  React.useEffect(() => {
    if (!open) set_q("");
  }, [open]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["global_search", club_id, debounced],
    enabled: !!club_id && debounced.trim().length >= 2,
    queryFn: async (): Promise<Hit[]> => {
      const term = debounced.trim();
      const like = `%${term}%`;
      const hits: Hit[] = [];

      const [atl, com, fat, gar, eve, ist] = await Promise.all([
        supabase
          .from("atleti")
          .select("id, nome, cognome, codice_atleta")
          .eq("club_id", club_id)
          .or(
            `nome.ilike.${like},cognome.ilike.${like},codice_atleta.ilike.${like},genitore1_email.ilike.${like},genitore2_email.ilike.${like}`,
          )
          .limit(5),
        supabase
          .from("comunicazioni")
          .select("id, titolo, tipo")
          .eq("club_id", club_id)
          .or(`titolo.ilike.${like},testo.ilike.${like}`)
          .limit(5),
        supabase
          .from("fatture")
          .select("id, numero, descrizione, importo")
          .eq("club_id", club_id)
          .or(`numero.ilike.${like},descrizione.ilike.${like}`)
          .limit(5),
        supabase
          .from("gare_calendario")
          .select("id, nome, luogo, data")
          .eq("club_id", club_id)
          .or(`nome.ilike.${like},luogo.ilike.${like},club_ospitante.ilike.${like}`)
          .limit(5),
        supabase
          .from("eventi_straordinari")
          .select("id, titolo, data, luogo")
          .eq("club_id", club_id)
          .or(`titolo.ilike.${like},descrizione.ilike.${like},luogo.ilike.${like}`)
          .limit(5),
        supabase
          .from("istruttori")
          .select("id, nome, cognome, email")
          .eq("club_id", club_id)
          .or(`nome.ilike.${like},cognome.ilike.${like},email.ilike.${like}`)
          .limit(5),
      ]);

      (atl.data ?? []).forEach((a: any) =>
        hits.push({
          id: a.id,
          label: `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() || "Atleta",
          sub: a.codice_atleta ?? undefined,
          category: "atleti",
          route: `/atleti?focus=${a.id}`,
        }),
      );
      (com.data ?? []).forEach((c: any) =>
        hits.push({
          id: c.id,
          label: c.titolo || "(senza titolo)",
          sub: c.tipo,
          category: "comunicazioni",
          route: `/comunicazioni?focus=${c.id}`,
        }),
      );
      (fat.data ?? []).forEach((f: any) =>
        hits.push({
          id: f.id,
          label: f.numero || f.descrizione || "Fattura",
          sub: f.importo != null ? `CHF ${Number(f.importo).toFixed(2)}` : undefined,
          category: "fatture",
          route: `/fatture?focus=${f.id}`,
        }),
      );
      (gar.data ?? []).forEach((g: any) =>
        hits.push({
          id: g.id,
          label: g.nome || "Gara",
          sub: [g.data, g.luogo].filter(Boolean).join(" · "),
          category: "gare",
          route: `/gare?focus=${g.id}`,
        }),
      );
      (eve.data ?? []).forEach((e: any) =>
        hits.push({
          id: e.id,
          label: e.titolo || "Evento",
          sub: [e.data, e.luogo].filter(Boolean).join(" · "),
          category: "eventi",
          route: `/eventi?focus=${e.id}`,
        }),
      );
      (ist.data ?? []).forEach((i: any) =>
        hits.push({
          id: i.id,
          label: `${i.cognome ?? ""} ${i.nome ?? ""}`.trim() || "Istruttore",
          sub: i.email ?? undefined,
          category: "istruttori",
          route: `/istruttori?focus=${i.id}`,
        }),
      );

      return hits;
    },
  });

  const grouped = React.useMemo(() => {
    const map = new Map<Hit["category"], Hit[]>();
    for (const h of results) {
      const arr = map.get(h.category) ?? [];
      arr.push(h);
      map.set(h.category, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  const handle_select = (hit: Hit) => {
    on_open_change(false);
    navigate(hit.route);
  };

  return (
    <CommandDialog open={open} onOpenChange={on_open_change}>
      <CommandInput
        placeholder="Cerca atleti, comunicazioni, fatture…"
        value={q}
        onValueChange={set_q}
        autoFocus
      />
      <CommandList>
        {debounced.trim().length < 2 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Digita almeno 2 caratteri per cercare in tutto il club.
          </div>
        )}
        {debounced.trim().length >= 2 && !isFetching && results.length === 0 && (
          <CommandEmpty>Nessun risultato.</CommandEmpty>
        )}
        {grouped.map(([cat, items], idx) => {
          const meta = CATEGORY_META[cat];
          return (
            <React.Fragment key={cat}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={meta.label}>
                {items.map((h) => (
                  <CommandItem
                    key={`${cat}-${h.id}`}
                    value={`${cat}-${h.id}-${h.label}`}
                    onSelect={() => handle_select(h)}
                  >
                    <meta.Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{h.label}</span>
                    {h.sub && (
                      <span className="ml-2 text-xs text-muted-foreground truncate max-w-[40%]">
                        {h.sub}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          );
        })}
      </CommandList>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">↑↓</kbd> naviga
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Enter</kbd> apri
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Esc</kbd> chiudi
        </span>
        {isFetching && <span>Caricamento…</span>}
      </div>
    </CommandDialog>
  );
};

export default GlobalSearchPalette;
