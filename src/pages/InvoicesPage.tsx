import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SearchableListLayout from "@/components/common/SearchableListLayout";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "react-i18next";
import {
  use_fatture,
  use_atleti,
  get_atleta_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_genera_fatture_mensili } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Receipt } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import { toast } from "@/hooks/use-toast";
import { get_fattura_stato_ui, get_fattura_stato_label, get_fattura_stato_classes } from "@/lib/fattura-status";



// ─── Main Page ─────────────────────────────────────────────
const InvoicesPage: React.FC = () => {
  const { t } = useTranslation("fatture");
  const { data: fatture = [], isLoading } = use_fatture();
  const { data: atleti = [] } = use_atleti();
  const genera = use_genera_fatture_mensili();
  const [status_filter, set_status_filter] = useState("tutti");
  const [search_raw, set_search_raw] = useState("");
  const search = useDebouncedValue(search_raw, 200);
  const [periodo_filter, set_periodo_filter] = useState<"tutti" | "mese" | "trimestre" | "anno">("tutti");
  const [sort_by, set_sort_by] = useState<"data_desc" | "importo_desc" | "scadenza">("data_desc");
  const [search_params] = useSearchParams();
  const navigate = useNavigate();

  // Deep-link legacy: /fatture?id=<uuid> → nuovo editor completo
  useEffect(() => {
    const id = search_params.get("id");
    if (id) navigate(`/segreteria/fatture/${id}`, { replace: true });
  }, [search_params, navigate]);


  const today_iso = new Date().toISOString().split("T")[0];

  const get_atleta_name = (id: string) => {
    const a = atleti.find((x: any) => x.id === id);
    return a ? `${a.nome ?? ""} ${a.cognome ?? ""}`.trim().toLowerCase() : "";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date();
    const periodo_threshold = (() => {
      if (periodo_filter === "mese") return new Date(today.getFullYear(), today.getMonth(), 1);
      if (periodo_filter === "trimestre") return new Date(today.getFullYear(), today.getMonth() - 3, 1);
      if (periodo_filter === "anno") return new Date(today.getFullYear(), 0, 1);
      return null;
    })();
    const list = fatture.filter((f: any) => {
      if (status_filter !== "tutti" && get_fattura_stato_ui(f, today_iso) !== status_filter) return false;
      if (q) {
        const hay = [f.numero, f.descrizione, get_atleta_name(f.atleta_id)].filter(Boolean).join(" ");
        if (!hay.includes(q)) return false;
      }
      if (periodo_threshold && f.data_emissione) {
        const d = new Date(f.data_emissione + "T00:00:00");
        if (d < periodo_threshold) return false;
      }
      return true;
    });
    const sorted = [...list].sort((a: any, b: any) => {
      if (sort_by === "importo_desc") return Number(b.importo) - Number(a.importo);
      if (sort_by === "scadenza") return (a.data_scadenza ?? "").localeCompare(b.data_scadenza ?? "");
      return (b.data_emissione ?? "").localeCompare(a.data_emissione ?? "");
    });
    return sorted;
  }, [fatture, status_filter, search, periodo_filter, sort_by, today_iso, atleti]);

  const non_pagate = fatture.filter((f: any) => f.stato !== "pagata");
  const totale_da_pagare = non_pagate.reduce((s: number, f: any) => s + Number(f.importo), 0);
  const scadute_count = non_pagate.filter((f: any) => get_fattura_stato_ui(f, today_iso) === "scaduta").length;
  const in_arrivo_count = non_pagate.length - scadute_count;

  // Totali dinamici sulla lista filtrata
  const totale_filtrato = filtered.reduce((s: number, f: any) => s + Number(f.importo ?? 0), 0);
  const totale_filtrato_scadute = filtered
    .filter((f: any) => get_fattura_stato_ui(f, today_iso) === "scaduta")
    .reduce((s: number, f: any) => s + Number(f.importo ?? 0), 0);

  const handle_genera = async () => {
    try {
      const count = await genera.mutateAsync(undefined);
      toast({ title: t("invoices_page.toast.generated_title", { count }) });
    } catch (err: any) {
      toast({ title: t("invoices_page.toast.generate_error_title"), description: err?.message, variant: "destructive" });
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>


      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t("invoices_page.title")}</h1>
            {totale_da_pagare > 0 && (
              <p
                className="text-sm text-muted-foreground mt-0.5"
                title={t("invoices_page.due_summary_tooltip", { overdue: scadute_count, upcoming: in_arrivo_count })}
              >
                {t("invoices_page.to_collect")} <span className="font-bold text-foreground">CHF {totale_da_pagare.toFixed(2)}</span>
                {scadute_count > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                    · {t("invoices_page.overdue_count", { count: scadute_count })}
                  </span>
                )}
              </p>
            )}
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={handle_genera} disabled={genera.isPending}>
            <FileText className="w-4 h-4 mr-2" /> {genera.isPending ? t("invoices_page.generating") : t("invoices_page.generate_button")}
          </Button>
        </div>

        <SearchableListLayout
          search={search_raw}
          on_search_change={set_search_raw}
          search_placeholder={t("invoices_page.search_placeholder")}
          filters={(() => {
            // Stato data-driven: leggiamo i valori reali presenti nelle fatture
            // del club + l'eventuale stato "scaduta" calcolato a runtime.
            const distinct_stati_db = Array.from(
              new Set(
                fatture
                  .map((f: any) => f?.stato)
                  .filter((v: any) => v !== null && v !== undefined && String(v).trim() !== "")
              )
            ) as string[];
            const ha_scadute = fatture.some(
              (f: any) => get_fattura_stato_ui(f, today_iso) === "scaduta"
            );
            const stato_options = [
              { value: "tutti", label: t("invoices_page.filters.all") },
              ...distinct_stati_db
                .sort()
                .map((s) => ({ value: s, label: get_fattura_stato_label(s as any) })),
              ...(ha_scadute ? [{ value: "scaduta", label: t("invoices_page.filters.overdue") }] : []),
            ];
            const filtri: any[] = [];
            if (distinct_stati_db.length + (ha_scadute ? 1 : 0) > 1) {
              filtri.push({
                key: "stato", label: t("invoices_page.filters.status_label"), value: status_filter,
                options: stato_options,
                onChange: set_status_filter,
              });
            }
            filtri.push({
              key: "periodo", label: t("invoices_page.filters.period_label"), value: periodo_filter,
              options: [
                { value: "tutti", label: t("invoices_page.filters.period_all") },
                { value: "mese", label: t("invoices_page.filters.period_month") },
                { value: "trimestre", label: t("invoices_page.filters.period_quarter") },
                { value: "anno", label: t("invoices_page.filters.period_year") },
              ],
              onChange: (v: string) => set_periodo_filter(v as any),
            });
            return filtri;
          })()}
          sort={{
            value: sort_by,
            onChange: (v) => set_sort_by(v as any),
            options: [
              { value: "data_desc", label: t("invoices_page.sort.date_desc") },
              { value: "scadenza", label: t("invoices_page.sort.due_asc") },
              { value: "importo_desc", label: t("invoices_page.sort.amount_desc") },
            ],
          }}
          count_filtered={filtered.length}
          count_total={fatture.length}
          extra_summary={
            <span className="font-semibold text-foreground">
              {t("invoices_page.summary.total")} CHF {totale_filtrato.toFixed(2)}
              {totale_filtrato_scadute > 0 && (
                <span className="ml-2 text-red-700">· {t("invoices_page.summary.overdue_amount")} CHF {totale_filtrato_scadute.toFixed(2)}</span>
              )}
            </span>
          }
        >
          <div />
        </SearchableListLayout>


        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("invoices_page.table.number")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("invoices_page.table.name")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    {t("invoices_page.table.description")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("invoices_page.table.amount")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("invoices_page.table.due_date")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("invoices_page.table.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      <EmptyState
                        icon={Receipt}
                        titolo={t("invoices_page.empty.title")}
                        descrizione={t("invoices_page.empty.description")}
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((f: any) => (
                    <tr
                      key={f.id}
                      onClick={() => navigate(`/segreteria/fatture/${f.id}`)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium tabular-nums text-foreground">{f.numero}</td>
                      <td className="px-4 py-3 text-foreground">{get_atleta_name_from_list(atleti, f.atleta_id)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                        {f.descrizione}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                        CHF {Number(f.importo).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                        {f.data_scadenza || f.scadenza
                          ? new Date(f.data_scadenza || f.scadenza).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const s = get_fattura_stato_ui(f, today_iso);
                          return (
                            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${get_fattura_stato_classes(s)}`}>
                              {get_fattura_stato_label(s)}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoicesPage;
