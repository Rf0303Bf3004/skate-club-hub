import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { use_stagioni } from "@/hooks/use-supabase-data";
import { use_upsert_stagione, use_elimina_stagione } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import FormDialog, { FormField } from "@/components/forms/FormDialog";
import { toast } from "@/hooks/use-toast";

const SeasonsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: stagioni = [], isLoading } = use_stagioni();
  const upsert = use_upsert_stagione();
  const elimina = use_elimina_stagione();
  const [form_open, set_form_open] = useState(false);
  const [form_data, set_form_data] = useState<Record<string, any>>({});

  const fields: FormField[] = [
    { key: "nome", label: t("nome"), required: true },
    {
      key: "tipo",
      label: t("tipo_stagione"),
      type: "select",
      options: [
        { value: "regolare", label: t("regolare") },
        { value: "pre_season", label: t("pre_season") },
        { value: "post_season", label: t("post_season") },
        { value: "campo", label: t("campo") },
      ],
    },
    { key: "data_inizio", label: t("data_inizio"), type: "date", required: true },
    { key: "data_fine", label: t("data_fine"), type: "date", required: true },
    { key: "attiva", label: t("attivo"), type: "checkbox" },
  ];

  const open_new = () => {
    set_form_data({ tipo: "regolare", attiva: true });
    set_form_open(true);
  };

  const open_edit = (s: any) => {
    set_form_data({
      id: s.id,
      nome: s.nome,
      tipo: s.tipo,
      data_inizio: s.data_inizio,
      data_fine: s.data_fine,
      attiva: s.attiva,
    });
    set_form_open(true);
  };

  const handle_submit = async () => {
    await upsert.mutateAsync(form_data);
    set_form_open(false);
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(form_data.id);
      set_form_open(false);
      toast({ title: "🗑️ Stagione eliminata correttamente" });
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
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t("stagioni")}</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={open_new}>
          <Plus className="w-4 h-4 mr-2" /> {t("nuova_stagione")}
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
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
                {t("data_inizio")}
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                {t("data_fine")}
              </th>
              <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t("stato")}
              </th>
            </tr>
          </thead>
          <tbody>
            {stagioni.map((s: any) => (
              <tr
                key={s.id}
                onClick={() => open_edit(s)}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground">{s.nome}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-xs">
                    {t(s.tipo)}
                  </Badge>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                  {new Date(s.data_inizio).toLocaleDateString("it-CH")}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                  {new Date(s.data_fine).toLocaleDateString("it-CH")}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={s.attiva ? "default" : "secondary"} className="text-xs">
                    {s.attiva ? t("attivo") : t("inattivo")}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormDialog
        open={form_open}
        on_close={() => set_form_open(false)}
        title={form_data.id ? t("modifica") : t("nuova_stagione")}
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

export default SeasonsPage;
