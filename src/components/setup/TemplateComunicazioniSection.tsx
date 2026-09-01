import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import ConfirmButton from "@/components/common/ConfirmButton";

type Template = { id: string; nome: string; testo: string | null };

/**
 * Gestione dei messaggi predefiniti usati dalla "Comunicazione rapida"
 * in Dashboard. Lista + aggiungi + modifica + elimina.
 */
const TemplateComunicazioniSection: React.FC<{ club_id: string | null }> = ({ club_id }) => {
  const queryClient = useQueryClient();
  const { puo_comunicare } = usePermessiAzione();
  const [bozza, set_bozza] = useState<Record<string, { nome: string; testo: string }>>({});
  const [saving_id, set_saving_id] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    enabled: !!club_id,
    queryKey: ["comunicazioni_template", club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicazioni_template")
        .select("id,nome,testo")
        .eq("club_id", club_id as string)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const invalida = () => queryClient.invalidateQueries({ queryKey: ["comunicazioni_template"] });

  const get_val = (t: Template, campo: "nome" | "testo") =>
    bozza[t.id]?.[campo] ?? (campo === "nome" ? t.nome : t.testo ?? "");

  const set_val = (t: Template, campo: "nome" | "testo", value: string) =>
    set_bozza((prev) => ({
      ...prev,
      [t.id]: {
        nome: prev[t.id]?.nome ?? t.nome,
        testo: prev[t.id]?.testo ?? t.testo ?? "",
        [campo]: value,
      },
    }));

  const salva = async (t: Template) => {
    set_saving_id(t.id);
    const { error } = await supabase
      .from("comunicazioni_template")
      .update({ nome: get_val(t, "nome"), testo: get_val(t, "testo") })
      .eq("id", t.id);
    set_saving_id(null);
    if (error) return toast.error("Errore salvataggio messaggio");
    set_bozza((prev) => {
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    invalida();
    toast.success("Messaggio predefinito aggiornato");
  };

  const elimina = async (t: Template) => {
    const { error } = await supabase.from("comunicazioni_template").delete().eq("id", t.id);
    if (error) return toast.error("Errore eliminazione messaggio");
    invalida();
    toast.success("Messaggio eliminato");
  };

  const aggiungi = async () => {
    if (!club_id) return;
    const { error } = await supabase
      .from("comunicazioni_template")
      .insert({ club_id, nome: "Nuovo messaggio", testo: "" });
    if (error) return toast.error("Errore creazione messaggio");
    invalida();
  };

  if (!club_id) return null;
  if (isLoading) return <p className="text-xs text-muted-foreground">Caricamento messaggi…</p>;

  return (
    <div className="space-y-3">
      {templates.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nessun messaggio predefinito — creane uno con il pulsante qui sotto.
        </p>
      )}
      {templates.map((t) => {
        const modificato = !!bozza[t.id];
        return (
          <div key={t.id} className="rounded-md border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-sm"
                value={get_val(t, "nome")}
                onChange={(e) => set_val(t, "nome", e.target.value)}
                placeholder="Nome del messaggio"
                disabled={!puo_comunicare}
              />
              {puo_comunicare && (
                <ConfirmButton
                  titolo={`Eliminare il messaggio "${t.nome}"?`}
                  descrizione="L'operazione non può essere annullata."
                  conferma_label="Elimina"
                  on_conferma={() => elimina(t)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </ConfirmButton>
              )}
            </div>
            <Textarea
              rows={3}
              className="text-sm"
              value={get_val(t, "testo")}
              onChange={(e) => set_val(t, "testo", e.target.value)}
              placeholder="Testo del messaggio…"
              disabled={!puo_comunicare}
            />
            {puo_comunicare && (
              <div className="flex justify-end">
                <Button size="sm" disabled={!modificato || saving_id === t.id} onClick={() => salva(t)}>
                  {saving_id === t.id ? "..." : "Salva"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {puo_comunicare ? (
        <Button variant="outline" size="sm" onClick={aggiungi}>
          <Plus className="w-4 h-4 mr-1" /> Aggiungi messaggio predefinito
        </Button>
      ) : (
        <NotaPermesso testo="Solo lo staff di segreteria e direzione può gestire i messaggi predefiniti." />
      )}
    </div>
  );
};

export default TemplateComunicazioniSection;
