import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SearchableListLayout from "@/components/common/SearchableListLayout";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/lib/i18n";
import {
  use_fatture,
  use_atleti,
  get_atleta_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_genera_fatture_mensili } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Receipt } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import { toast } from "@/hooks/use-toast";
import { get_fattura_stato_ui, get_fattura_stato_label, get_fattura_stato_classes } from "@/lib/fattura-status";



// ─── Main Page ─────────────────────────────────────────────
const InvoicesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: fatture = [], isLoading } = use_fatture();
  const { data: atleti = [] } = use_atleti();
  const { data: setup } = use_setup_club();
  const { data: club } = use_club();
  const { data: corsi = [] } = use_corsi();
  const { data: lezioni = [] } = use_lezioni_private();
  const segna_pagata = use_segna_fattura_pagata();
  const genera = use_genera_fatture_mensili();
  const elimina = use_elimina_fattura();
  const invia_email = use_invia_email_fattura();
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
      toast({ title: `✅ ${count} fatture generate` });
    } catch (err: any) {
      toast({ title: "Errore generazione", description: err?.message, variant: "destructive" });
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
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t("fatture")}</h1>
            {totale_da_pagare > 0 && (
              <p
                className="text-sm text-muted-foreground mt-0.5"
                title={`${scadute_count} scadute / ${in_arrivo_count} in arrivo`}
              >
                Da incassare: <span className="font-bold text-foreground">CHF {totale_da_pagare.toFixed(2)}</span>
                {scadute_count > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                    · {scadute_count} scadute
                  </span>
                )}
              </p>
            )}
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={handle_genera} disabled={genera.isPending}>
            <FileText className="w-4 h-4 mr-2" /> {genera.isPending ? "..." : t("genera_fatture")}
          </Button>
        </div>

        <SearchableListLayout
          search={search_raw}
          on_search_change={set_search_raw}
          search_placeholder="Cerca per numero, descrizione, nome atleta…"
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
              { value: "tutti", label: t("tutti") },
              ...distinct_stati_db
                .sort()
                .map((s) => ({ value: s, label: get_fattura_stato_label(s as any) })),
              ...(ha_scadute ? [{ value: "scaduta", label: "Scadute" }] : []),
            ];
            const filtri: any[] = [];
            if (distinct_stati_db.length + (ha_scadute ? 1 : 0) > 1) {
              filtri.push({
                key: "stato", label: "Stato", value: status_filter,
                options: stato_options,
                onChange: set_status_filter,
              });
            }
            filtri.push({
              key: "periodo", label: "Periodo", value: periodo_filter,
              options: [
                { value: "tutti", label: "Tutti" },
                { value: "mese", label: "Questo mese" },
                { value: "trimestre", label: "Ultimo trimestre" },
                { value: "anno", label: "Anno corrente" },
              ],
              onChange: (v: string) => set_periodo_filter(v as any),
            });
            return filtri;
          })()}
          sort={{
            value: sort_by,
            onChange: (v) => set_sort_by(v as any),
            options: [
              { value: "data_desc", label: "Data emissione ↓" },
              { value: "scadenza", label: "Scadenza ↑" },
              { value: "importo_desc", label: "Importo ↓" },
            ],
          }}
          count_filtered={filtered.length}
          count_total={fatture.length}
          extra_summary={
            <span className="font-semibold text-foreground">
              Totale: CHF {totale_filtrato.toFixed(2)}
              {totale_filtrato_scadute > 0 && (
                <span className="ml-2 text-red-700">· scadute CHF {totale_filtrato_scadute.toFixed(2)}</span>
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
                    {t("numero_fattura")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("nome")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    {t("descrizione")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("importo")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("scadenza")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("stato")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      <EmptyState
                        icon={Receipt}
                        titolo="Nessuna fattura da mostrare"
                        descrizione="Con i filtri attivi non risulta nessuna fattura. Azzera i filtri oppure genera le fatture del mese dalla sezione Fatturazione."
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((f: any) => (
                    <tr
                      key={f.id}
                      onClick={() => set_selected_fattura(f)}
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
