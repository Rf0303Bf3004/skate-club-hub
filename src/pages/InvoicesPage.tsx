import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { use_fatture, use_atleti, get_atleta_name_from_list } from "@/hooks/use-supabase-data";
import {
  use_segna_fattura_pagata,
  use_genera_fatture_mensili,
  use_elimina_fattura,
} from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

const InvoicesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: fatture = [], isLoading } = use_fatture();
  const { data: atleti = [] } = use_atleti();
  const segna_pagata = use_segna_fattura_pagata();
  const genera = use_genera_fatture_mensili();
  const elimina = use_elimina_fattura();
  const [status_filter, set_status_filter] = useState("tutti");
  const [confirm_id, set_confirm_id] = useState<string | null>(null);

  const filtered = fatture.filter((f: any) => status_filter === "tutti" || f.stato === status_filter);

  const handle_genera = async () => {
    const count = await genera.mutateAsync();
    toast.success(`${count} fatture generate`);
  };

  const handle_paga = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await segna_pagata.mutateAsync(id);
    toast.success("Fattura segnata come pagata");
  };

  const handle_elimina = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm_id !== id) {
      set_confirm_id(id);
      return;
    }
    try {
      await elimina.mutateAsync(id);
      set_confirm_id(null);
      toast.success("Fattura eliminata");
    } catch (err: any) {
      toast.error(err?.message || "Errore eliminazione");
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t("fatture")}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={handle_genera} disabled={genera.isPending}>
          <FileText className="w-4 h-4 mr-2" /> {genera.isPending ? "..." : t("genera_fatture")}
        </Button>
      </div>

      <Select value={status_filter} onValueChange={set_status_filter}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={t("stato")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tutti">{t("tutti")}</SelectItem>
          <SelectItem value="pagata">{t("pagata")}</SelectItem>
          <SelectItem value="da_pagare">{t("da_pagare")}</SelectItem>
        </SelectContent>
      </Select>

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
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("azioni")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f: any) => (
                <React.Fragment key={f.id}>
                  <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">{f.numero}</td>
                    <td className="px-4 py-3 text-foreground">{get_atleta_name_from_list(atleti, f.atleta_id)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                      {f.descrizione}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">CHF {f.importo}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                      {f.scadenza ? new Date(f.scadenza).toLocaleDateString("it-CH") : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={f.stato === "pagata" ? "default" : "destructive"} className="text-xs">
                        {t(f.stato)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {f.stato !== "pagata" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handle_paga(e, f.id)}
                            disabled={segna_pagata.isPending}
                            className="h-7 text-xs"
                          >
                            <Check className="w-3 h-3 mr-1" /> {t("pagata")}
                          </Button>
                        )}
                        {confirm_id === f.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => handle_elimina(e, f.id)}
                              disabled={elimina.isPending}
                              className="h-7 text-xs"
                            >
                              {elimina.isPending ? "..." : "Conferma"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                set_confirm_id(null);
                              }}
                              className="h-7 text-xs"
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handle_elimina(e, f.id)}
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;
