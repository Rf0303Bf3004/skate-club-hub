import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { Trash2, AlertTriangle } from "lucide-react";

export interface FormField {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "email" | "textarea" | "select" | "checkbox" | "multi-select" | "time";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

interface Props {
  open: boolean;
  on_close: () => void;
  title: string;
  fields: FormField[];
  values: Record<string, any>;
  on_change: (key: string, value: any) => void;
  on_submit: () => void;
  on_delete?: () => void;
  delete_loading?: boolean;
  loading?: boolean;
}

const FormDialog: React.FC<Props> = ({
  open,
  on_close,
  title,
  fields,
  values,
  on_change,
  on_submit,
  on_delete,
  delete_loading,
  loading,
}) => {
  const { t } = useI18n();
  const [confirm_delete, set_confirm_delete] = useState(false);

  const handle_close = () => {
    set_confirm_delete(false);
    on_close();
  };

  const handle_delete = () => {
    set_confirm_delete(false);
    on_delete?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handle_close()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Pannello conferma eliminazione */}
        {confirm_delete && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm font-semibold text-destructive">Conferma eliminazione</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Questa operazione è irreversibile. Tutti i dati collegati verranno eliminati.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set_confirm_delete(false)}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handle_delete}
                disabled={delete_loading}
                className="flex-1"
              >
                {delete_loading ? "..." : "🗑️ Elimina definitivamente"}
              </Button>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            on_submit();
          }}
          className="space-y-4"
        >
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-sm font-medium">{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  value={values[f.key] || ""}
                  onChange={(e) => on_change(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              ) : f.type === "select" ? (
                <Select value={values[f.key] || ""} onValueChange={(v) => on_change(f.key, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={f.placeholder || f.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <Checkbox checked={!!values[f.key]} onCheckedChange={(v) => on_change(f.key, !!v)} />
                  <span className="text-sm">{f.label}</span>
                </div>
              ) : f.type === "multi-select" ? (
                <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                  {f.options?.map((o) => {
                    const selected = (values[f.key] || []).includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          const current = values[f.key] || [];
                          on_change(
                            f.key,
                            selected ? current.filter((v: string) => v !== o.value) : [...current, o.value],
                          );
                        }}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors
                          ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Input
                  type={f.type || "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    on_change(
                      f.key,
                      f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value,
                    )
                  }
                  required={f.required}
                  placeholder={f.placeholder}
                  step={f.type === "number" ? "any" : undefined}
                />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-2">
            {/* Bottone elimina — appare solo se on_delete è passato E si sta modificando (values.id esiste) */}
            {on_delete && values.id && !confirm_delete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set_confirm_delete(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Elimina
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handle_close}>
                {t("annulla")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "..." : t("salva")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FormDialog;
