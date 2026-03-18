import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { use_corsi, use_istruttori, get_istruttore_name_from_list } from "@/hooks/use-supabase-data";
import { use_upsert_corso, use_elimina_corso } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import FormDialog, { FormField } from "@/components/forms/FormDialog";
import { toast } from "@/hooks/use-toast";

const GIORNI_DB = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const CoursesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: corsi = [], isLoading } = use_corsi();
  const { data: istruttori = [] } = use_istruttori();
  const upsert = use_upsert_corso();
  const elimina = use_elimina_corso();
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});

  const fields: FormField[] = [
    { key: "nome", label: t("nome"), required: true },
    { key: "tipo", label: t("tipo") },
    { key: "giorno", label: t("giorno"), type: "select", options: GIORNI_DB.map((d) => ({ value: d, label: d })) },
    { key: "ora_inizio", label: t("ora_inizio"), type: "time" },
    { key: "ora_fine", label: t("ora_fine"), type: "time" },
    { key: "costo_mensile", label: t("costo_mensile"), type: "number" },
    { key: "costo_annuale", label: t("costo_annuale"), type: "number" },
    {
      key: "istruttori_ids",
      label: t("istruttori"),
      type: "multi-select",
      options: istruttori.map((i: any) => ({ value: i.id, label: `${i.nome} ${i.cognome}` })),
    },
    { key: "attivo", label: t("attivo"), type: "checkbox" },
    { key: "note", label: t("note"), type: "textarea" },
  ];

  const open_new = () => {
    set_form_data({ giorno: "Lunedì", ora_inizio: "08:00", ora_fine: "09:00", attivo: true, istruttori_ids: [] });
    set_form_open(true);
  };

  const open_edit = (c: any) => {
    set_form_data({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      giorno: c.giorno,
      ora_inizio: c.ora_inizio?.slice(0, 5),
      ora_fine: c.ora_fine?.slice(0, 5),
      costo_mensile: c.costo_mensile,
      costo_annuale: c.costo_annuale,
      istruttori_ids: Array.from(new Set(c.istruttori_ids || [])),
      attivo: c.stato === "attivo",
      note: c.note || "",
      stagione_id: c.stagione_id,
    });
    set_form_open(true);
  };

  const handle_submit = async () => {
    try {
      await upsert.mutateAsync({ ...form_data, istruttori_ids: Array.from(new Set(form_data.istruttori_ids || [])) });
      set_form_open(false);
    } catch (err) {
      console.error("Errore salvataggio corso", err);
    }
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(form_data.id);
      set_form_open(false);
      toast({ title: "🗑️ Corso eliminato correttamente" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t("corsi")}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}>
          <Plus className="w-4 h-4 mr-2" /> {t("nuovo_corso")}
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("nome")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("tipo")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  {t("giorno")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  {t("ora_inizio")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  {t("istruttori")}
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("iscritti")}
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  {t("costo_mensile")}
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("stato")}
                </th>
              </tr>
            </thead>
            <tbody>
              {corsi.map((c: any) => (
                <tr
                  key={c.id}
                  onClick={() => open_edit(c)}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {c.tipo?.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.giorno}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                    {c.ora_inizio?.slice(0, 5)} - {c.ora_fine?.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {(c.istruttori_ids || [])
                      .map((id: string) => get_istruttore_name_from_list(istruttori, id))
                      .join(", ")}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums font-medium text-foreground">
                    {(c.atleti_ids || []).length}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                    CHF {c.costo_mensile}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${c.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormDialog
        open={form_open}
        on_close={() => set_form_open(false)}
        title={form_data.id ? t("modifica") : t("nuovo_corso")}
        fields={fields}
        values={form_data}
        on_change={(k, v) => set_form_data((p) => ({ ...p, [k]: v }))}
        on_submit={handle_submit}
        on_delete={form_data.id ? handle_delete : undefined}
        delete_loading={elimina.isPending}
        loading={upsert.isPending}
      />
    </div>
  );
};

export default CoursesPage;
