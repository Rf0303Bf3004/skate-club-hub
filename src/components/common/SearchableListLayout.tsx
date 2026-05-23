import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type FilterChip = {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
};

export type SortConfig = {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
};

interface Props {
  search: string;
  on_search_change: (v: string) => void;
  search_placeholder?: string;
  filters?: FilterChip[];
  sort?: SortConfig;
  count_filtered: number;
  count_total: number;
  extra_summary?: React.ReactNode;
  children: React.ReactNode;
  sticky?: boolean;
  right_actions?: React.ReactNode;
}

const SearchableListLayout: React.FC<Props> = ({
  search,
  on_search_change,
  search_placeholder = "Cerca…",
  filters = [],
  sort,
  count_filtered,
  count_total,
  extra_summary,
  children,
  sticky = true,
  right_actions,
}) => {
  const has_active_filters =
    !!search ||
    filters.some((f) => f.value && f.value !== "tutti" && f.value !== "all" && f.value !== "");

  const reset_all = () => {
    on_search_change("");
    filters.forEach((f) => f.onChange(f.options[0]?.value ?? ""));
  };

  return (
    <div className="space-y-4">
      <div
        className={`${
          sticky ? "sticky top-14 z-20 bg-background/95 backdrop-blur-md -mx-4 px-4 lg:-mx-8 lg:px-8 py-3 border-b border-border" : ""
        }`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                aria-label="Ricerca"
                value={search}
                onChange={(e) => on_search_change(e.target.value)}
                placeholder={search_placeholder}
                className="pl-9 pr-9 h-10"
              />
              {search && (
                <button
                  aria-label="Pulisci ricerca"
                  onClick={() => on_search_change("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {sort && (
              <Select value={sort.value} onValueChange={sort.onChange}>
                <SelectTrigger className="h-10 w-auto min-w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sort.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      Ordina: {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {right_actions}
          </div>

          {filters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {filters.map((f) => (
                <Select key={f.key} value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs">
                    <span className="text-muted-foreground mr-1">{f.label}:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
              {has_active_filters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset_all}
                  className="h-8 text-xs text-muted-foreground"
                >
                  <X className="w-3 h-3 mr-1" /> Reset
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground tabular-nums">{count_filtered}</span>
              {" "}di{" "}
              <span className="tabular-nums">{count_total}</span> risultati
            </span>
            {extra_summary && <div>{extra_summary}</div>}
          </div>
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
};

export default SearchableListLayout;
