import React from "react";
import { Link } from "react-router-dom";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { FileText, BarChart3, Paperclip, BookOpen, ListTree, Flag, RotateCcw, GripVertical, ArrowRight } from "lucide-react";
import SortableItem from "./SortableItem";
import { CompositoreItem } from "./types-compositore";

interface Props {
  items: CompositoreItem[];
  on_reorder: (new_order: string[]) => void;
  on_toggle: (item: CompositoreItem, attivo: boolean) => void;
  on_select: (id: string) => void;
  selected_id: string | null;
  on_reset: () => void;
}

function icon_for(kind: CompositoreItem["kind"], sezione_id?: string) {
  if (kind === "blocco") return FileText;
  if (kind === "area") return BarChart3;
  if (kind === "allegato") return Paperclip;
  if (sezione_id === "copertina") return BookOpen;
  if (sezione_id === "indice") return ListTree;
  return Flag;
}

function ParagrafiNarrativiSub({ area_id }: { area_id: string }) {
  const ORDINI = [
    { ordine: 1, label: "Apertura empatica" },
    { ordine: 2, label: "Numeri narrati" },
    { ordine: 3, label: "Interpretazione" },
    { ordine: 4, label: "Ponte alla sezione successiva" },
  ];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-md border border-slate-200 bg-[#f8fafc] p-2 text-[11px] text-[#475569] select-none cursor-default">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-1 font-medium text-slate-600">
                <ArrowRight className="w-3 h-3 rotate-90" />
                4 paragrafi del Racconto dei dati
              </span>
              <Link
                to={`/presidente/relazione/contenuti?tab=paragrafi&area=${area_id}`}
                className="text-teal-700 hover:text-teal-900 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Modifica i paragrafi
              </Link>
            </div>
            <ul className="pl-4 space-y-0.5 list-none">
              {ORDINI.map((o) => (
                <li key={o.ordine} className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-slate-200 text-[9px] font-semibold text-slate-600">
                    {o.ordine}
                  </span>
                  <span>{o.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          Questi 4 paragrafi vengono inseriti automaticamente nella pagina del PDF.
          Li puoi modificare nella tab Contenuti &gt; Racconto dei dati.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function IndiceComponibile({ items, on_reorder, on_toggle, on_select, selected_id, on_reset }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [active_id, set_active_id] = React.useState<string | null>(null);
  const [optimistic_ids, set_optimistic_ids] = React.useState<string[] | null>(null);

  // Reset optimistic order when the underlying cached order changes, including rollback cases.
  const items_key = React.useMemo(() => items.map((i) => `${i.id}:${i.ordine}:${i.attivo}`).join("|"), [items]);
  React.useEffect(() => { set_optimistic_ids(null); }, [items_key]);

  const displayed = React.useMemo(() => {
    if (!optimistic_ids) return items;
    const map = new Map(items.map((i) => [i.id, i]));
    const ordered: typeof items = [];
    for (const id of optimistic_ids) { const it = map.get(id); if (it) ordered.push(it); }
    // append any items not in optimistic list (safety)
    for (const it of items) if (!optimistic_ids.includes(it.id)) ordered.push(it);
    return ordered;
  }, [items, optimistic_ids]);

  const handle_end = (e: DragEndEvent) => {
    set_active_id(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = displayed.map((i) => i.id);
    const old_index = ids.indexOf(String(active.id));
    const new_index = ids.indexOf(String(over.id));
    if (old_index === -1 || new_index === -1) return;
    const next = [...ids];
    const [moved] = next.splice(old_index, 1);
    next.splice(new_index, 0, moved);
    set_optimistic_ids(next); // immediate visual reorder
    on_reorder(next);
  };

  const active = displayed.find((i) => i.id === active_id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-lg text-foreground">Struttura relazione</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Trascina per riordinare. Disattiva per escludere dal PDF.</p>
          <p className="text-xs text-slate-500 mt-1 mb-1">
            Le aree dashboard includono automaticamente i paragrafi narrativi che vedi qui sotto.
            Puoi modificarli nella tab Contenuti &gt; Racconto dei dati.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={on_reset} className="gap-1.5 text-xs h-7">
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => set_active_id(String(e.active.id))}
        onDragEnd={handle_end}
        onDragCancel={() => set_active_id(null)}
      >
        <SortableContext items={displayed.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5 overflow-y-auto pr-2 flex-1">
            {displayed.map((it) => (
              <React.Fragment key={it.id}>
                <SortableItem id={it.id} disabled={it.locked}>
                  <ItemRow
                    item={it}
                    selected={selected_id === it.id}
                    on_toggle={(v) => on_toggle(it, v)}
                    on_select={() => on_select(it.id)}
                  />
                </SortableItem>
                {it.kind === "area" && it.attivo && (
                  <div className="pl-8 mt-1">
                    <ParagrafiNarrativiSub area_id={it.sezione_id!} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {active ? (
            <div className="flex items-center gap-2 bg-card border border-border rounded-md p-2 shadow-lg">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <ItemRow item={active} selected={false} on_toggle={() => {}} on_select={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function ItemRow({ item, selected, on_toggle, on_select }: { item: CompositoreItem; selected: boolean; on_toggle: (v: boolean) => void; on_select: () => void }) {
  const Icon = icon_for(item.kind, item.sezione_id);
  return (
    <Card
      onClick={on_select}
      className={`p-2.5 cursor-pointer transition-colors ${selected ? "ring-2 ring-primary" : "hover:bg-accent/50"} ${!item.attivo ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.titolo}</p>
          <p className="text-[11px] text-muted-foreground truncate">{item.sottotitolo}</p>
        </div>
        {!item.locked && (
          <Switch
            checked={item.attivo}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={on_toggle}
          />
        )}
        {item.locked && (
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">sistema</span>
        )}
      </div>
    </Card>
  );
}
