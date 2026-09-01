import React, { useEffect, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableItem from "@/components/relazione/SortableItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import ConfirmButton from "@/components/common/ConfirmButton";
import {
  use_griglia_specialita,
  use_upsert_specialita,
  use_elimina_specialita,
  type GrigliaSpecialita,
} from "@/hooks/use-griglia-ghiaccio";

/** CRUD minimale sulla tassonomia delle specialità della griglia ghiaccio. */
const SpecialitaManager: React.FC = () => {
  const { puo_pianificare } = usePermessiAzione();
  const { data: specialita = [], isLoading } = use_griglia_specialita();
  const upsert = use_upsert_specialita();
  const elimina = use_elimina_specialita();

  const [lista, set_lista] = useState<GrigliaSpecialita[]>([]);
  const [nuovo_nome, set_nuovo_nome] = useState("");
  const [nuova_descrizione, set_nuova_descrizione] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    set_lista(specialita);
  }, [specialita]);

  const handle_drag_end = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const old_index = lista.findIndex((s) => s.id === active.id);
    const new_index = lista.findIndex((s) => s.id === over.id);
    if (old_index < 0 || new_index < 0) return;
    const nuova = arrayMove(lista, old_index, new_index);
    set_lista(nuova);
    try {
      await Promise.all(
        nuova.map((s, idx) =>
          upsert.mutateAsync({
            id: s.id,
            nome: s.nome,
            ordine: idx + 1,
            attivo: s.attivo,
            descrizione_messaggio: s.descrizione_messaggio ?? null,
          }),
        ),
      );
      toast({ title: "Ordine aggiornato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const aggiungi = async () => {
    const nome = nuovo_nome.trim();
    if (!nome) return;
    try {
      await upsert.mutateAsync({
        nome,
        ordine: lista.length + 1,
        attivo: true,
        descrizione_messaggio: nuova_descrizione.trim() || null,
      });
      set_nuovo_nome("");
      set_nuova_descrizione("");
      toast({ title: "Specialità aggiunta" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const salva_descrizione = async (s: GrigliaSpecialita, descrizione: string) => {
    if ((s.descrizione_messaggio ?? "") === descrizione) return;
    try {
      await upsert.mutateAsync({
        id: s.id,
        nome: s.nome,
        ordine: s.ordine,
        attivo: s.attivo,
        descrizione_messaggio: descrizione.trim() || null,
      });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const rimuovi = async (id: string) => {
    try {
      await elimina.mutateAsync(id);
      toast({ title: "Specialità eliminata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3 flex flex-col min-h-0 flex-1">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 max-h-[55vh]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handle_drag_end}>
        <SortableContext items={lista.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {lista.map((s) => (
              <SortableItem key={s.id} id={s.id}>
                <div className="px-3 py-2 bg-muted/30 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{s.nome}</span>
                    {puo_pianificare && (
                      <ConfirmButton
                        titolo={`Eliminare la specialità "${s.nome}"?`}
                        conferma_label="Elimina"
                        on_conferma={() => rimuovi(s.id)}
                      >
                        <Button variant="ghost" size="icon" title="Elimina">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </ConfirmButton>
                    )}
                  </div>
                  <Input
                    defaultValue={s.descrizione_messaggio ?? ""}
                    onBlur={(e) => void salva_descrizione(s, e.target.value)}
                    placeholder="Descrizione per i messaggi (es. lavoro su equilibrio e velocità)"
                    className="h-7 text-xs"
                  />
                </div>
              </SortableItem>
            ))}
            {lista.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">Nessuna specialità configurata.</p>
            )}
          </div>
        </SortableContext>
      </DndContext>
      </div>

      {!puo_pianificare && <NotaPermesso testo="Solo chi può pianificare può gestire le specialità." />}
      {puo_pianificare && (
      <div className="pt-2 border-t space-y-2 shrink-0">
        <div className="flex items-center gap-2">
        <Input
          value={nuovo_nome}
          onChange={(e) => set_nuovo_nome(e.target.value)}
          placeholder="Nuova specialità…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void aggiungi();
            }
          }}
        />
        <Button onClick={aggiungi} disabled={!nuovo_nome.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Aggiungi
        </Button>
        </div>
        <Input
          value={nuova_descrizione}
          onChange={(e) => set_nuova_descrizione(e.target.value)}
          placeholder="Descrizione per i messaggi (es. lavoro su equilibrio e velocità)"
          className="h-8 text-xs"
        />
      </div>
      )}
    </div>
  );
};

export default SpecialitaManager;
