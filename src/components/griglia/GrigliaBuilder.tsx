import React, { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { use_atleti, use_istruttori } from "@/hooks/use-supabase-data";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import {
  use_griglia_specialita,
  use_upsert_sessione,
  use_elimina_sessione,
  use_assegna_atleta_sessione,
  use_rimuovi_atleta_sessione,
  use_assegna_istruttore_sessione,
  use_rimuovi_istruttore_sessione,
  use_pubblica_blocco,
  type GrigliaBlocco,
  type GrigliaSessione,
} from "@/hooks/use-griglia-ghiaccio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SpecialitaManager from "@/components/griglia/SpecialitaManager";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Settings, Plus, Trash2, X, GraduationCap, Send, CheckCircle2, GripVertical, HelpCircle } from "lucide-react";

const DURATA_DEFAULT_MIN = 20;
const ALTRO = "__altro__";

function hhmm(t?: string | null): string {
  return (t ?? "").slice(0, 5);
}

function to_min(t?: string | null): number {
  const [h, m] = hhmm(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function from_min(v: number): string {
  const h = Math.floor(v / 60) % 24;
  const m = v % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function iniziali(nome?: string, cognome?: string): string {
  return `${(nome || "?").charAt(0)}${(cognome || "").charAt(0)}`.toUpperCase();
}

// ─── Pillola draggable (pool sorgente) ─────────────────────
const PillolaDraggable: React.FC<{
  drag_id: string;
  label: string;
  sigla: string;
  is_istruttore?: boolean;
}> = ({ drag_id, label, sigla, is_istruttore }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: drag_id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-full border text-xs cursor-grab active:cursor-grabbing select-none",
        is_istruttore ? "bg-primary/10 border-primary/40" : "bg-background border-border",
        isDragging && "opacity-40",
      )}
      title={label}
    >
      <span
        className={cn(
          "shrink-0 w-5 h-5 rounded-full grid place-items-center text-[9px] font-semibold",
          is_istruttore ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {sigla}
      </span>
      <span className="truncate max-w-[9rem]">{label}</span>
    </div>
  );
};

// ─── Intestazione gruppo (livello) draggable ───────────────
const GruppoDraggable: React.FC<{
  drag_id: string;
  livello: string;
  atleta_ids: string[];
}> = ({ drag_id, livello, atleta_ids }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: drag_id,
    data: { tipo: "gruppo", atleta_ids },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`Trascina tutto il gruppo ${livello} (${atleta_ids.length})`}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30",
        "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        "cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40",
      )}
    >
      <GripVertical className="w-3 h-3 shrink-0" />
      <span className="truncate">{livello}</span>
      <span className="ml-auto text-[10px] font-normal">· {atleta_ids.length}</span>
    </div>
  );
};

// ─── Box pool sorgente ─────────────────────────────────────
const PoolBox: React.FC<{
  titolo: string;
  items: { id: string; nome: string; cognome: string; livello_attuale?: string | null }[];
  prefisso: "atleta" | "istruttore";
  variante_istruttori?: boolean;
  colore?: string | null;
  box_id?: string;
  neutro?: boolean;
}> = ({ titolo, items, prefisso, variante_istruttori, colore, box_id, neutro }) => {
  const [q, set_q] = useState("");
  const filtrati = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => `${i.nome} ${i.cognome}`.toLowerCase().includes(term));
  }, [items, q]);

  // Raggruppamento per livello (solo per gli atleti)
  const gruppi = useMemo(() => {
    if (prefisso !== "atleta") return [];
    const map = new Map<string, typeof filtrati>();
    for (const i of filtrati) {
      const liv = (i.livello_attuale || "Senza livello") as string;
      map.set(liv, [...(map.get(liv) ?? []), i]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "it"));
  }, [filtrati, prefisso]);

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2",
        variante_istruttori
          ? "bg-primary/5 border-primary/30"
          : neutro
            ? "bg-muted/40 border-dashed border-muted-foreground/40"
            : "bg-muted/20 border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          {variante_istruttori && <GraduationCap className="w-4 h-4 text-primary" />}
          {!variante_istruttori && neutro && <HelpCircle className="w-4 h-4 text-muted-foreground" />}
          {!variante_istruttori && !neutro && colore && (
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colore }} />
          )}
          <span className="truncate">{titolo}</span>
        </h4>
        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
      </div>
      <Input
        value={q}
        onChange={(e) => set_q(e.target.value)}
        placeholder="Cerca…"
        className="h-7 text-xs"
      />
      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
        {prefisso === "atleta"
          ? gruppi.map(([livello, membri]) => (
              <div key={livello} className="flex flex-col gap-1">
                <GruppoDraggable
                  drag_id={`gruppo:${box_id ?? titolo}:${livello}`}
                  livello={livello}
                  atleta_ids={membri.map((m) => m.id)}
                />
                <div className="flex flex-col gap-1 pl-2 border-l border-border/60">
                  {membri.map((i) => (
                    <PillolaDraggable
                      key={i.id}
                      drag_id={`atleta:${i.id}`}
                      label={`${i.nome} ${i.cognome}`}
                      sigla={iniziali(i.nome, i.cognome)}
                    />
                  ))}
                </div>
              </div>
            ))
          : filtrati.map((i) => (
              <PillolaDraggable
                key={i.id}
                drag_id={`istruttore:${i.id}`}
                label={`${i.nome} ${i.cognome}`}
                sigla={iniziali(i.nome, i.cognome)}
                is_istruttore
              />
            ))}
        {filtrati.length === 0 && <p className="text-xs text-muted-foreground py-1">Nessun risultato.</p>}
      </div>
    </div>
  );
};


// ─── Box sessione (droppable) ──────────────────────────────
const SessioneBox: React.FC<{
  sessione: GrigliaSessione;
  specialita: { id: string; nome: string; attivo: boolean }[];
  on_change: (patch: Partial<GrigliaSessione>) => void;
  on_elimina: () => void;
  on_rimuovi_atleta: (atleta_id: string) => void;
  on_rimuovi_istruttore: (istruttore_id: string) => void;
}> = ({ sessione, specialita, on_change, on_elimina, on_rimuovi_atleta, on_rimuovi_istruttore }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `sessione:${sessione.id}` });
  const usa_testo = !sessione.specialita_id && !!sessione.specialita_testo_libero;
  const [modo_libero, set_modo_libero] = useState(usa_testo);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="time"
          value={hhmm(sessione.ora_inizio)}
          onChange={(e) => on_change({ ora_inizio: e.target.value })}
          className="h-8 w-[7.5rem]"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="time"
          value={hhmm(sessione.ora_fine)}
          onChange={(e) => on_change({ ora_fine: e.target.value })}
          className="h-8 w-[7.5rem]"
        />
        <div className="flex-1 min-w-[12rem]">
          <Select
            value={modo_libero ? ALTRO : sessione.specialita_id ?? ""}
            onValueChange={(v) => {
              if (v === ALTRO) {
                set_modo_libero(true);
                on_change({ specialita_id: null, specialita_testo_libero: sessione.specialita_testo_libero ?? "" });
              } else {
                set_modo_libero(false);
                on_change({ specialita_id: v, specialita_testo_libero: null });
              }
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Specialità…" />
            </SelectTrigger>
            <SelectContent>
              {specialita
                .filter((s) => s.attivo)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              <SelectItem value={ALTRO}>Altro (testo libero)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="icon" onClick={on_elimina} title="Rimuovi sotto-sessione">
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      {modo_libero && (
        <Input
          value={sessione.specialita_testo_libero ?? ""}
          onChange={(e) => on_change({ specialita_testo_libero: e.target.value, specialita_id: null })}
          placeholder="Specialità (testo libero)"
          className="h-8"
        />
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[3.5rem] rounded-lg border-2 border-dashed p-2 flex flex-wrap gap-1.5 transition-colors",
          isOver ? "border-primary bg-primary/5" : "border-border bg-muted/10",
        )}
      >
        {sessione.atleti.length === 0 && sessione.istruttori.length === 0 && (
          <p className="text-xs text-muted-foreground self-center">Trascina qui atleti e istruttori…</p>
        )}
        {sessione.istruttori.map((i) => (
          <span
            key={i.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-primary/40 bg-primary/10"
          >
            <GraduationCap className="w-3 h-3 text-primary" />
            {i.nome} {i.cognome}
            <button type="button" onClick={() => on_rimuovi_istruttore(i.istruttore_id)} aria-label="Rimuovi">
              <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
            </button>
          </span>
        ))}
        {sessione.atleti.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-border bg-background"
          >
            {a.nome} {a.cognome}
            <button type="button" onClick={() => on_rimuovi_atleta(a.atleta_id)} aria-label="Rimuovi">
              <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Builder ───────────────────────────────────────────────
interface Props {
  blocco: GrigliaBlocco;
  blocchi_giorno: GrigliaBlocco[];
}

const GrigliaBuilder: React.FC<Props> = ({ blocco, blocchi_giorno }) => {
  const { data: atleti = [] } = use_atleti();
  const { data: istruttori = [] } = use_istruttori();
  const { data: specialita = [] } = use_griglia_specialita();
  const { data: ragioni_sociali = [] } = use_ragioni_sociali();
  const { modalita: modalita_fatturazione } = useModalitaArea("fatturazione");

  const upsert_sessione = use_upsert_sessione();
  const elimina_sessione = use_elimina_sessione();
  const assegna_atleta = use_assegna_atleta_sessione();
  const rimuovi_atleta = use_rimuovi_atleta_sessione();
  const assegna_istruttore = use_assegna_istruttore_sessione();
  const rimuovi_istruttore = use_rimuovi_istruttore_sessione();
  const pubblica = use_pubblica_blocco();

  const [open_specialita, set_open_specialita] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Box sorgente dinamici: uno per ragione sociale attiva (solo se modalità multi_ragione_sociale
  // e almeno una ragione sociale configurata). Altrimenti fallback: un unico box "Club" con i non esterni.
  const ragioni_attive = useMemo(
    () =>
      modalita_fatturazione === "multi_ragione_sociale"
        ? (ragioni_sociali ?? []).filter((r) => r.attivo)
        : [],
    [modalita_fatturazione, ragioni_sociali],
  );

  const pool_ragioni = useMemo(
    () =>
      ragioni_attive.map((r) => ({
        id: r.id,
        titolo: r.nome,
        colore: r.colore_primario,
        items: (atleti as any[]).filter((a) => a.ragione_sociale_id === r.id),
      })),
    [ragioni_attive, atleti],
  );

  const pool_club_fallback = useMemo(
    () => (atleti as any[]).filter((a) => !a.atleta_esterno),
    [atleti],
  );
  // Atleti non esterni e non ancora assegnati ad alcuna ragione sociale:
  // devono restare visibili quando i box dinamici per ragione sociale sono attivi.
  const pool_senza_ragione_sociale = useMemo(
    () =>
      ragioni_attive.length > 0
        ? (atleti as any[]).filter((a) => !a.atleta_esterno && !a.ragione_sociale_id)
        : [],
    [ragioni_attive, atleti],
  );

  const pool_esterni = useMemo(() => (atleti as any[]).filter((a) => a.atleta_esterno), [atleti]);
  const pool_istruttori = useMemo(() => (istruttori as any[]).filter((i) => i.attivo), [istruttori]);

  const sessioni = blocco.sessioni ?? [];

  /** Avvisa (non blocca) se la persona è già in un'altra sessione sovrapposta nello stesso giorno. */
  const avvisa_sovrapposizione = (
    tipo: "atleta" | "istruttore",
    persona_id: string,
    nome: string,
    dest: GrigliaSessione,
  ) => {
    const d_start = to_min(dest.ora_inizio);
    const d_end = to_min(dest.ora_fine);
    const conflitto = blocchi_giorno.some((b) =>
      (b.sessioni ?? []).some((s) => {
        if (s.id === dest.id) return false;
        const overlap = to_min(s.ora_inizio) < d_end && to_min(s.ora_fine) > d_start;
        if (!overlap) return false;
        return tipo === "atleta"
          ? s.atleti.some((a) => a.atleta_id === persona_id)
          : s.istruttori.some((i) => i.istruttore_id === persona_id);
      }),
    );
    if (conflitto) {
      toast({
        title: `⚠️ ${nome} è già assegnato a un'altra sessione in questo orario`,
        variant: "destructive",
      });
    }
  };

  const handle_drag_end = async (event: any) => {
    const { active, over } = event;
    if (!over) return;
    const over_id = String(over.id);
    if (!over_id.startsWith("sessione:")) return;
    const sessione_id = over_id.slice("sessione:".length);
    const dest = sessioni.find((s) => s.id === sessione_id);
    if (!dest) return;

    const [tipo, persona_id] = String(active.id).split(":");
    try {
      if (tipo === "gruppo") {
        const ids: string[] = active.data?.current?.atleta_ids ?? [];
        for (const atleta_id of ids) {
          const a = (atleti as any[]).find((x) => x.id === atleta_id);
          const nome = a ? `${a.nome} ${a.cognome}` : "Atleta";
          avvisa_sovrapposizione("atleta", atleta_id, nome, dest);
          await assegna_atleta.mutateAsync({ sessione_id, atleta_id });
        }
        if (ids.length > 0) toast({ title: `✅ ${ids.length} atleti assegnati alla sessione` });
      } else if (tipo === "atleta") {
        const a = (atleti as any[]).find((x) => x.id === persona_id);
        const nome = a ? `${a.nome} ${a.cognome}` : "Atleta";
        avvisa_sovrapposizione("atleta", persona_id, nome, dest);
        await assegna_atleta.mutateAsync({ sessione_id, atleta_id: persona_id });
      } else if (tipo === "istruttore") {
        const i = (istruttori as any[]).find((x) => x.id === persona_id);
        const nome = i ? `${i.nome} ${i.cognome}` : "Istruttore";
        avvisa_sovrapposizione("istruttore", persona_id, nome, dest);
        await assegna_istruttore.mutateAsync({ sessione_id, istruttore_id: persona_id });
      }
    } catch (e: any) {
      toast({ title: "Errore assegnazione", description: e.message, variant: "destructive" });
    }
  };

  const aggiungi_sessione = async () => {
    const ultima = sessioni[sessioni.length - 1];
    const inizio = ultima ? to_min(ultima.ora_fine) : to_min(blocco.ora_inizio);
    const fine = Math.min(inizio + DURATA_DEFAULT_MIN, to_min(blocco.ora_fine) || inizio + DURATA_DEFAULT_MIN);
    try {
      await upsert_sessione.mutateAsync({
        blocco_id: blocco.id,
        ordine: (ultima?.ordine ?? 0) + 1,
        ora_inizio: from_min(inizio),
        ora_fine: from_min(fine > inizio ? fine : inizio + DURATA_DEFAULT_MIN),
      });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const salva_sessione = async (s: GrigliaSessione, patch: Partial<GrigliaSessione>) => {
    const merged = { ...s, ...patch };
    try {
      await upsert_sessione.mutateAsync({
        id: s.id,
        blocco_id: s.blocco_id,
        ordine: merged.ordine,
        ora_inizio: hhmm(merged.ora_inizio),
        ora_fine: hhmm(merged.ora_fine),
        specialita_id: merged.specialita_id,
        specialita_testo_libero: merged.specialita_testo_libero,
        note: merged.note,
      });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handle_pubblica = async () => {
    try {
      await pubblica.mutateAsync(blocco.id);
      toast({ title: "✅ Griglia pubblicata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra azioni */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {blocco.stato === "pubblicato" ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Pubblicato{blocco.pubblicato_at ? ` il ${new Date(blocco.pubblicato_at).toLocaleDateString("it-CH")}` : ""}
            </Badge>
          ) : (
            <Button size="sm" onClick={handle_pubblica} disabled={pubblica.isPending}>
              <Send className="w-4 h-4 mr-1" /> Pubblica griglia
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => set_open_specialita(true)}>
          <Settings className="w-4 h-4 mr-1" /> Gestisci specialità
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handle_drag_end}>
        {/* Fascia superiore: pool sorgente */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {pool_ragioni.length > 0 ? (
            pool_ragioni.map((p) => (
              <PoolBox key={p.id} box_id={p.id} titolo={p.titolo} items={p.items} prefisso="atleta" colore={p.colore} />
            ))
          ) : (
            <PoolBox box_id="club" titolo="Club" items={pool_club_fallback} prefisso="atleta" />
          )}
          {pool_senza_ragione_sociale.length > 0 && (
            <PoolBox
              box_id="senza_rs"
              titolo="Senza ragione sociale"
              items={pool_senza_ragione_sociale}
              prefisso="atleta"
              neutro
            />
          )}
          <PoolBox box_id="esterni" titolo="Esterni" items={pool_esterni} prefisso="atleta" />
          <PoolBox titolo="Istruttori" items={pool_istruttori} prefisso="istruttore" variante_istruttori />
        </div>

        {/* Fascia inferiore: sotto-sessioni */}
        <div className="space-y-3 mt-4">
          {sessioni.map((s) => (
            <SessioneBox
              key={s.id}
              sessione={s}
              specialita={specialita as any[]}
              on_change={(patch) => salva_sessione(s, patch)}
              on_elimina={() => elimina_sessione.mutateAsync(s.id)}
              on_rimuovi_atleta={(atleta_id) => rimuovi_atleta.mutateAsync({ sessione_id: s.id, atleta_id })}
              on_rimuovi_istruttore={(istruttore_id) =>
                rimuovi_istruttore.mutateAsync({ sessione_id: s.id, istruttore_id })
              }
            />
          ))}
          {sessioni.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessuna sotto-sessione. Aggiungine una per iniziare.</p>
          )}
          <Button variant="outline" size="sm" onClick={aggiungi_sessione}>
            <Plus className="w-4 h-4 mr-1" /> Aggiungi sotto-sessione
          </Button>
        </div>
      </DndContext>

      <Dialog open={open_specialita} onOpenChange={set_open_specialita}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestisci specialità</DialogTitle>
          </DialogHeader>
          <SpecialitaManager />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrigliaBuilder;
