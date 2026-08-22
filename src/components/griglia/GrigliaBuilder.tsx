import React, { useEffect, useMemo, useState } from "react";
import { get_current_club_id } from "@/lib/supabase";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { use_atleti, use_istruttori } from "@/hooks/use-supabase-data";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { VERDE_ESTERNI } from "@/components/ProvenienzaLegenda";
import {
  use_griglia_specialita,
  use_upsert_sessione,
  use_elimina_sessione,
  use_assegna_atleta_sessione,
  use_rimuovi_atleta_sessione,
  use_assegna_istruttore_sessione,
  use_rimuovi_istruttore_sessione,
  use_pubblica_blocco,
  use_disponibilita_giorno,
  use_ripeti_sessione,
  risolvi_membri_gruppo,
  giorno_it_da_data,
  type GruppoScope,
  type GrigliaBlocco,
  type GrigliaSessione,
} from "@/hooks/use-griglia-ghiaccio";
import { use_risorse_strutture } from "@/hooks/use-risorse-strutture";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SpecialitaManager from "@/components/griglia/SpecialitaManager";
import ConfermaForzaturaDisponibilita from "@/components/griglia/ConfermaForzaturaDisponibilita";
import RipetiSessioneDialog from "@/components/griglia/RipetiSessioneDialog";
import { verifica_orario_disponibilita } from "@/lib/availability";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Settings, Plus, Trash2, X, GraduationCap, Send, CheckCircle2, GripVertical, HelpCircle, ChevronDown, ChevronRight, AlertTriangle, Repeat, Link2, RefreshCw } from "lucide-react";

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

// Orari pregenerati ogni 5 minuti (00:00 – 23:55): evita la digitazione manuale nei time input nativi.
const ORARI_5_MIN: string[] = Array.from({ length: (24 * 60) / 5 }, (_, i) => from_min(i * 5));

const OrarioSelect: React.FC<{ value: string; onChange: (v: string) => void; aria_label: string }> = ({
  value,
  onChange,
  aria_label,
}) => {
  const v = hhmm(value);
  const opzioni = useMemo(() => (v && !ORARI_5_MIN.includes(v) ? [v, ...ORARI_5_MIN] : ORARI_5_MIN), [v]);
  return (
    <Select value={v || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[7.5rem]" aria-label={aria_label}>
        <SelectValue placeholder="--:--" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {opzioni.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};


// ─── Testi messaggio convocazione ──────────────────────────
const GIORNI_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function etichetta_giorno(data_iso: string): string {
  if (!data_iso) return "";
  const d = new Date(`${data_iso}T00:00:00`);
  const oggi = new Date();
  const key = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const domani = new Date(oggi);
  domani.setDate(oggi.getDate() + 1);
  const data_fmt = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  if (key(d) === key(oggi)) return `Oggi ${data_fmt}`;
  if (key(d) === key(domani)) return `Domani ${data_fmt}`;
  return `${GIORNI_IT[d.getDay()]} ${data_fmt}`;
}

function nome_specialita(s: GrigliaSessione): string {
  return s.specialita_nome || s.specialita_testo_libero || "allenamento";
}

function testo_istruttori(s: GrigliaSessione): string {
  return (s.istruttori ?? []).map((i) => `${i.nome} ${i.cognome}`.trim()).join(", ");
}

export function messaggio_standard(s: GrigliaSessione, data_iso: string): string {
  const desc = s.specialita_descrizione ? ` – ${s.specialita_descrizione}` : "";
  const ist = testo_istruttori(s);
  return `${etichetta_giorno(data_iso)} in pista dalle ${hhmm(s.ora_inizio)} alle ${hhmm(s.ora_fine)} ${nome_specialita(s)}${desc}${ist ? `, Istruttore ${ist}` : ""}.`;
}

export function messaggio_breve(s: GrigliaSessione, data_iso: string): string {
  const desc = s.specialita_descrizione ? ` – ${s.specialita_descrizione}` : "";
  const ist = testo_istruttori(s);
  return `${etichetta_giorno(data_iso)} ore ${hhmm(s.ora_inizio)}-${hhmm(s.ora_fine)}: ${nome_specialita(s)}${desc}${ist ? ` con ${ist}` : ""}.`;
}

// ─── Pillola draggable (pool sorgente) ─────────────────────
const PillolaDraggable: React.FC<{
  drag_id: string;
  label: string;
  sigla: string;
  is_istruttore?: boolean;
  colore?: string | null;
}> = ({ drag_id, label, sigla, is_istruttore, colore }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: drag_id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-full border text-xs cursor-grab active:cursor-grabbing select-none",
        is_istruttore ? "bg-primary/10 border-primary/40" : colore ? "border-border" : "bg-background border-border",
        isDragging && "opacity-40",
      )}
      style={colore ? { borderLeft: `3px solid ${colore}`, backgroundColor: `${colore}1A` } : undefined}
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

// ─── Scope del gruppo (mappa i 4 box sorgente) ─────────────
const LIVELLO_NON_DEFINITO = "Senza livello";

export function scope_da_box_id(box_id?: string): {
  gruppo_scope: GruppoScope;
  gruppo_ragione_sociale_id: string | null;
} {
  if (box_id === "club") return { gruppo_scope: "club", gruppo_ragione_sociale_id: null };
  if (box_id === "senza_rs")
    return { gruppo_scope: "senza_ragione_sociale", gruppo_ragione_sociale_id: null };
  if (box_id === "esterni") return { gruppo_scope: "esterni", gruppo_ragione_sociale_id: null };
  return { gruppo_scope: "ragione_sociale", gruppo_ragione_sociale_id: box_id ?? null };
}

// ─── Intestazione gruppo (livello) draggable ───────────────
const GruppoDraggable: React.FC<{
  drag_id: string;
  livello: string;
  atleta_ids: string[];
  box_id?: string;
  colore?: string | null;
  aperto?: boolean;
  on_toggle?: () => void;
}> = ({ drag_id, livello, atleta_ids, box_id, colore, aperto, on_toggle }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: drag_id,
    data: { tipo: "gruppo", atleta_ids, livello, box_id },
  });
  const down_ref = React.useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        down_ref.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e);
      }}
      onClick={(e) => {
        const d = down_ref.current;
        down_ref.current = null;
        if (!d) return;
        const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        if (dist < 5) on_toggle?.();
      }}
      title={`Trascina tutto il gruppo ${livello} (${atleta_ids.length}) · clicca per aprire/chiudere`}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30",
        "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        "cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40",
      )}
      style={colore ? { borderLeft: `3px solid ${colore}`, backgroundColor: `${colore}1A` } : undefined}
    >
      <GripVertical className="w-3 h-3 shrink-0" />
      {aperto ? (
        <ChevronDown className="w-3 h-3 shrink-0" />
      ) : (
        <ChevronRight className="w-3 h-3 shrink-0" />
      )}
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
  const [aperto, set_aperto] = useState(true);
  const [gruppi_aperti, set_gruppi_aperti] = useState<Record<string, boolean>>({});
  const ricerca_attiva = q.trim().length > 0;

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
      <button
        type="button"
        onClick={() => set_aperto((v) => !v)}
        className="flex items-center justify-between gap-2 text-left"
      >
        <h4 className="text-sm font-semibold flex items-center gap-1.5 min-w-0">
          {aperto ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          )}
          {variante_istruttori && <GraduationCap className="w-4 h-4 text-primary" />}
          {!variante_istruttori && neutro && <HelpCircle className="w-4 h-4 text-muted-foreground" />}
          {!variante_istruttori && !neutro && colore && (
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colore }} />
          )}
          <span className="truncate">{titolo}</span>
        </h4>
        <Badge variant="secondary" className="text-[10px] shrink-0">{items.length}</Badge>
      </button>
      <Input
        value={q}
        onChange={(e) => {
          set_q(e.target.value);
          if (e.target.value.trim()) set_aperto(true);
        }}
        placeholder="Cerca…"
        className="h-7 text-xs"
      />
      {aperto && (
        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
          {prefisso === "atleta"
            ? gruppi.map(([livello, membri]) => {
                const gruppo_aperto = ricerca_attiva || !!gruppi_aperti[livello];
                return (
                <div key={livello} className="flex flex-col gap-1">
                  <GruppoDraggable
                    drag_id={`gruppo:${box_id ?? titolo}:${livello}`}
                    livello={livello}
                    atleta_ids={membri.map((m) => m.id)}
                    box_id={box_id}
                    colore={colore}
                    aperto={gruppo_aperto}
                    on_toggle={() =>
                      set_gruppi_aperti((prev) => ({ ...prev, [livello]: !gruppo_aperto }))
                    }
                  />
                  {gruppo_aperto && (
                  <div className="flex flex-col gap-1 pl-2 border-l border-border/60">
                    {membri.map((i) => (
                      <PillolaDraggable
                        key={i.id}
                        drag_id={`atleta:${i.id}`}
                        label={`${i.nome} ${i.cognome}`}
                        sigla={iniziali(i.nome, i.cognome)}
                        colore={colore}
                      />
                    ))}
                  </div>
                  )}
                </div>
                );
              })

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
      )}
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
  on_ripeti?: () => void;
  on_sync_gruppo?: () => void;
  on_rimuovi_gruppo?: () => void;
  sync_in_corso?: boolean;
  atleti_tutti?: {
    id: string;
    nome?: string | null;
    cognome?: string | null;
    ragione_sociale_id?: string | null;
    atleta_esterno?: boolean | null;
  }[];
  ragioni_sociali?: { id: string; colore_primario: string | null }[];
  data_blocco: string;
}> = ({
  sessione,
  specialita,
  on_change,
  on_elimina,
  on_rimuovi_atleta,
  on_rimuovi_istruttore,
  on_ripeti,
  on_sync_gruppo,
  on_rimuovi_gruppo,
  sync_in_corso,
  atleti_tutti = [],
  ragioni_sociali = [],
  data_blocco,
}) => {

  const colore_atleta = (atleta_id: string): string | null => {
    const a = atleti_tutti.find((x) => x.id === atleta_id);
    if (!a) return null;
    if (a.atleta_esterno) return VERDE_ESTERNI;
    if (!a.ragione_sociale_id) return null;
    return ragioni_sociali.find((r) => r.id === a.ragione_sociale_id)?.colore_primario ?? null;
  };

  // Ordine visivo: stesso ordine dei box sorgente (ragioni sociali, senza ragione sociale, esterni),
  // poi alfabetico per cognome/nome all'interno di ciascun gruppo.
  const atleti_ordinati = useMemo(() => {
    const ordine_ragione = new Map<string, number>();
    ragioni_sociali.forEach((r, idx) => ordine_ragione.set(r.id, idx));
    const idx_senza = ragioni_sociali.length;
    const idx_esterni = ragioni_sociali.length + 1;

    const gruppo_di = (atleta_id: string): number => {
      const a = atleti_tutti.find((x) => x.id === atleta_id);
      if (!a) return idx_senza;
      if (a.atleta_esterno) return idx_esterni;
      if (a.ragione_sociale_id) return ordine_ragione.get(a.ragione_sociale_id) ?? idx_senza;
      return idx_senza;
    };

    return [...sessione.atleti].sort((a, b) => {
      const diff = gruppo_di(a.atleta_id) - gruppo_di(b.atleta_id);
      if (diff !== 0) return diff;
      return (
        (a.cognome ?? "").localeCompare(b.cognome ?? "", "it") ||
        (a.nome ?? "").localeCompare(b.nome ?? "", "it")
      );
    });
  }, [sessione.atleti, atleti_tutti, ragioni_sociali]);

  const { setNodeRef, isOver } = useDroppable({ id: `sessione:${sessione.id}` });
  const usa_testo = !sessione.specialita_id && !!sessione.specialita_testo_libero;
  const [modo_libero, set_modo_libero] = useState(usa_testo);
  const [messaggio, set_messaggio] = useState(sessione.messaggio_atleti ?? "");
  const [pista, set_pista] = useState(sessione.pista ?? "");
  const prefill_fatto = React.useRef(false);

  React.useEffect(() => {
    set_messaggio(sessione.messaggio_atleti ?? "");
  }, [sessione.messaggio_atleti]);

  React.useEffect(() => {
    set_pista(sessione.pista ?? "");
  }, [sessione.pista]);

  // Pre-riempimento automatico solo alla prima volta (messaggio ancora vuoto).
  React.useEffect(() => {
    if (prefill_fatto.current) return;
    if ((sessione.messaggio_atleti ?? "").trim()) {
      prefill_fatto.current = true;
      return;
    }
    if ((sessione.atleti ?? []).length === 0) return;
    prefill_fatto.current = true;
    const testo = messaggio_standard(sessione, data_blocco);
    set_messaggio(testo);
    on_change({ messaggio_atleti: testo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessione.atleti?.length, sessione.messaggio_atleti]);

  // ─── Pillola di gruppo: elenco membri risolto dal vivo ───
  const [gruppo_popover_open, set_gruppo_popover_open] = useState(false);
  const [membri_live, set_membri_live] = useState<string[] | null>(null);
  const [membri_live_loading, set_membri_live_loading] = useState(false);
  const [conferma_rimuovi_gruppo, set_conferma_rimuovi_gruppo] = useState(false);

  const nome_atleta = (atleta_id: string): string => {
    const salvato = (sessione.atleti ?? []).find((a) => a.atleta_id === atleta_id);
    if (salvato) return `${salvato.nome ?? ""} ${salvato.cognome ?? ""}`.trim() || atleta_id.slice(0, 8);
    const a = atleti_tutti.find((x) => x.id === atleta_id);
    return `${a?.nome ?? ""} ${a?.cognome ?? ""}`.trim() || atleta_id.slice(0, 8);
  };

  const carica_membri_live = async () => {
    if (!sessione.gruppo_livello) return;
    set_membri_live_loading(true);
    try {
      const ids = await risolvi_membri_gruppo(
        get_current_club_id(),
        sessione.gruppo_scope ?? null,
        sessione.gruppo_livello,
        sessione.gruppo_ragione_sociale_id ?? null,
      );
      set_membri_live(ids);
    } catch {
      set_membri_live(null);
    } finally {
      set_membri_live_loading(false);
    }
  };

  const salvati_ids = (sessione.atleti ?? []).map((a) => a.atleta_id);
  const nuovi_non_sincronizzati = (membri_live ?? []).filter((id) => !salvati_ids.includes(id));
  const non_piu_nel_gruppo = membri_live ? salvati_ids.filter((id) => !membri_live.includes(id)) : [];



  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <OrarioSelect
          value={hhmm(sessione.ora_inizio)}
          onChange={(v) => on_change({ ora_inizio: v })}
          aria_label="Ora inizio"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <OrarioSelect
          value={hhmm(sessione.ora_fine)}
          onChange={(v) => on_change({ ora_fine: v })}
          aria_label="Ora fine"
        />
        <Input
          value={pista}
          onChange={(e) => set_pista(e.target.value)}
          onBlur={() => {
            if ((sessione.pista ?? "") !== pista) on_change({ pista: pista.trim() || null });
          }}
          placeholder="Pista (facoltativa)"
          className="h-8 w-[9.5rem]"
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
        {sessione.corso_id && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Repeat className="w-3 h-3" /> Ricorrente
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Collegata al corso: {sessione.corso_nome ?? "corso ricorrente"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {sessione.gruppo_livello && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Link2 className="w-3 h-3" /> Gruppo: {sessione.gruppo_livello}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Collegata dinamicamente al gruppo «{sessione.gruppo_livello}»
                {sessione.gruppo_scope === "esterni" && " (esterni)"}
                {sessione.gruppo_scope === "senza_ragione_sociale" && " (senza ragione sociale)"}.
                Usa «Aggiorna dal gruppo» per riallineare gli atleti alla composizione attuale.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {sessione.gruppo_livello && on_sync_gruppo && (
          <Button
            variant="ghost"
            size="icon"
            onClick={on_sync_gruppo}
            disabled={sync_in_corso}
            title="Aggiorna dal gruppo"
          >
            <RefreshCw className={cn("w-4 h-4", sync_in_corso && "animate-spin")} />
          </Button>
        )}
        {on_ripeti && (
          <Button variant="ghost" size="icon" onClick={on_ripeti} title="Ripeti questa sessione">
            <Repeat className="w-4 h-4" />
          </Button>
        )}
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
        {sessione.gruppo_livello ? (
          (() => {
            const colore: string | null =
              (sessione.gruppo_scope === "esterni" ? VERDE_ESTERNI : null) ||
              (sessione.gruppo_ragione_sociale_id
                ? ragioni_sociali.find((r) => r.id === sessione.gruppo_ragione_sociale_id)?.colore_primario ?? null
                : null) ||
              (atleti_ordinati[0] ? colore_atleta(atleti_ordinati[0].atleta_id) : null);

            return (
              <Popover
                open={gruppo_popover_open}
                onOpenChange={(v) => {
                  set_gruppo_popover_open(v);
                  if (v) void carica_membri_live();
                }}
              >
                <PopoverTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    onMouseEnter={() => {
                      set_gruppo_popover_open(true);
                      void carica_membri_live();
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer",
                      colore ? "border-border" : "border-border bg-background",
                    )}
                    style={
                      colore ? { borderLeft: `3px solid ${colore}`, backgroundColor: `${colore}1A` } : undefined
                    }
                  >
                    <Link2 className="w-3 h-3" />
                    <span className="font-medium">{sessione.gruppo_livello}</span>
                    <span className="text-muted-foreground">· {sessione.atleti.length} atleti</span>
                    {on_rimuovi_gruppo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          set_conferma_rimuovi_gruppo(true);
                        }}
                        aria-label="Rimuovi collegamento al gruppo"
                      >
                        <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-64 text-xs"
                  onMouseLeave={() => set_gruppo_popover_open(false)}
                >
                  <p className="font-semibold mb-1">Membri attuali del gruppo</p>
                  {membri_live_loading && <p className="text-muted-foreground">Caricamento…</p>}
                  {!membri_live_loading && (
                    <ul className="space-y-0.5 max-h-48 overflow-y-auto">
                      {(membri_live ?? salvati_ids).map((id) => (
                        <li key={id} className="flex items-center gap-1">
                          {nuovi_non_sincronizzati.includes(id) && <span className="text-amber-600">★</span>}
                          {nome_atleta(id)}
                        </li>
                      ))}
                      {(membri_live ?? salvati_ids).length === 0 && (
                        <li className="text-muted-foreground">Nessun atleta nel gruppo.</li>
                      )}
                    </ul>
                  )}
                  {!membri_live_loading &&
                    membri_live &&
                    (nuovi_non_sincronizzati.length > 0 || non_piu_nel_gruppo.length > 0) && (
                      <p className="mt-2 pt-2 border-t text-amber-700">
                        {nuovi_non_sincronizzati.length > 0 &&
                          `★ ${nuovi_non_sincronizzati.length} nuovi non ancora sincronizzati`}
                        {nuovi_non_sincronizzati.length > 0 && non_piu_nel_gruppo.length > 0 && " · "}
                        {non_piu_nel_gruppo.length > 0 && `${non_piu_nel_gruppo.length} non più nel gruppo`}
                        {" — usa «Aggiorna dal gruppo»."}
                      </p>
                    )}
                </PopoverContent>
              </Popover>
            );
          })()
        ) : (
          atleti_ordinati.map((a) => {
            const colore = colore_atleta(a.atleta_id);
            return (
              <span
                key={a.id}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border",
                  colore ? "border-border" : "border-border bg-background",
                )}
                style={colore ? { borderLeft: `3px solid ${colore}`, backgroundColor: `${colore}1A` } : undefined}
              >
                {a.nome} {a.cognome}
                <button type="button" onClick={() => on_rimuovi_atleta(a.atleta_id)} aria-label="Rimuovi">
                  <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </span>
            );
          })
        )}

      </div>

      {(sessione.atleti ?? []).length > 0 && (
        <div className="space-y-2 pt-1 border-t">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">Messaggio agli atleti</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const t = messaggio_standard(sessione, data_blocco);
                set_messaggio(t);
                on_change({ messaggio_atleti: t });
              }}
            >
              Modello standard
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const t = messaggio_breve(sessione, data_blocco);
                set_messaggio(t);
                on_change({ messaggio_atleti: t });
              }}
            >
              Modello breve
            </Button>
          </div>
          <Textarea
            value={messaggio}
            onChange={(e) => set_messaggio(e.target.value)}
            onBlur={() => {
              if ((sessione.messaggio_atleti ?? "") !== messaggio)
                on_change({ messaggio_atleti: messaggio.trim() || null });
            }}
            rows={3}
            className="text-xs"
            placeholder="Testo che verrà inviato agli atleti alla pubblicazione…"
          />
        </div>
      )}
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
  const ripeti = use_ripeti_sessione();

  const [open_specialita, set_open_specialita] = useState(false);
  const [riepilogo_aperto, set_riepilogo_aperto] = useState(false);
  const [tab_attivo, set_tab_attivo] = useState<string | null>(null);
  const [forzatura_open, set_forzatura_open] = useState(false);
  const [motivo_blocco, set_motivo_blocco] = useState<string | null>(null);
  const [pending_patch, set_pending_patch] = useState<
    { sessione: GrigliaSessione; patch: Partial<GrigliaSessione> } | null
  >(null);
  const [ripeti_sessione, set_ripeti_sessione] = useState<GrigliaSessione | null>(null);
  const [sync_gruppo_id, set_sync_gruppo_id] = useState<string | null>(null);

  /**
   * Riallinea gli atleti della sessione alla composizione ATTUALE del gruppo
   * collegato: aggiunge i nuovi membri e rimuove chi non ne fa più parte.
   */
  const sync_gruppo_core = async (s: GrigliaSessione) => {
    const membri = await risolvi_membri_gruppo(
      get_current_club_id(),
      s.gruppo_scope ?? null,
      s.gruppo_livello!,
      s.gruppo_ragione_sociale_id ?? null,
    );
    const attuali = (s.atleti ?? []).map((a) => a.atleta_id);
    const da_aggiungere = membri.filter((id) => !attuali.includes(id));
    const da_rimuovere = attuali.filter((id) => !membri.includes(id));
    for (const atleta_id of da_aggiungere) {
      await assegna_atleta.mutateAsync({ sessione_id: s.id, atleta_id });
    }
    for (const atleta_id of da_rimuovere) {
      await rimuovi_atleta.mutateAsync({ sessione_id: s.id, atleta_id });
    }
    return { da_aggiungere: da_aggiungere.length, da_rimuovere: da_rimuovere.length };
  };

  const sincronizza_dal_gruppo = async (s: GrigliaSessione) => {
    if (!s.gruppo_livello) return;
    set_sync_gruppo_id(s.id);
    try {
      const { da_aggiungere, da_rimuovere } = await sync_gruppo_core(s);
      toast({
        title: "Gruppo aggiornato",
        description:
          da_aggiungere === 0 && da_rimuovere === 0
            ? "Nessuna variazione: la sessione è già allineata."
            : `+${da_aggiungere} aggiunti, −${da_rimuovere} rimossi.`,
      });
    } catch (e: any) {
      toast({ title: "Errore aggiornamento gruppo", description: e.message, variant: "destructive" });
    } finally {
      set_sync_gruppo_id(null);
    }
  };

  /** Rimuove il collegamento al gruppo: svuota gli atleti e azzera i metadati. */
  const rimuovi_collegamento_gruppo = async (s: GrigliaSessione) => {
    try {
      for (const a of s.atleti ?? []) {
        await rimuovi_atleta.mutateAsync({ sessione_id: s.id, atleta_id: a.atleta_id });
      }
      await upsert_sessione.mutateAsync({
        id: s.id,
        gruppo_livello: null,
        gruppo_scope: null,
        gruppo_ragione_sociale_id: null,
      } as any);
      toast({ title: "Collegamento rimosso", description: "La sessione è tornata gestibile manualmente." });
    } catch (e: any) {
      toast({ title: "Errore rimozione gruppo", description: e.message, variant: "destructive" });
    }
  };


  const giorno_blocco = useMemo(() => (blocco.data ? giorno_it_da_data(blocco.data) : null), [blocco.data]);
  const { data: risorse_tutte = [] } = use_risorse_strutture();
  const risorsa_blocco = risorse_tutte.find((r) => r.id === blocco.risorsa_id) ?? null;
  const { data: fasce_ghiaccio = [] } = use_disponibilita_giorno(blocco.risorsa_id ?? null, giorno_blocco);

  const { data: fasce_pulizia = [] } = use_disponibilita_giorno(
    blocco.risorsa_id ?? null,
    giorno_blocco,
    "pulizia",
  );
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
        // Collegamento dinamico: la sessione "ricorda" da quale gruppo arriva
        const livello_gruppo: string | undefined = active.data?.current?.livello;
        if (livello_gruppo && livello_gruppo !== LIVELLO_NON_DEFINITO) {
          const { gruppo_scope, gruppo_ragione_sociale_id } = scope_da_box_id(
            active.data?.current?.box_id,
          );
          await upsert_sessione.mutateAsync({
            id: dest.id,
            blocco_id: dest.blocco_id,
            ordine: dest.ordine,
            ora_inizio: dest.ora_inizio,
            ora_fine: dest.ora_fine,
            specialita_id: dest.specialita_id ?? null,
            specialita_testo_libero: dest.specialita_testo_libero ?? null,
            note: dest.note ?? null,
            pista: dest.pista ?? null,
            messaggio_atleti: dest.messaggio_atleti ?? null,
            gruppo_livello: livello_gruppo,
            gruppo_scope,
            gruppo_ragione_sociale_id,
          });
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
      const nuovo_id = await upsert_sessione.mutateAsync({
        blocco_id: blocco.id,
        ordine: (ultima?.ordine ?? 0) + 1,
        ora_inizio: from_min(inizio),
        ora_fine: from_min(fine > inizio ? fine : inizio + DURATA_DEFAULT_MIN),
      });
      if (nuovo_id) set_tab_attivo(nuovo_id);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const elimina_sessione_tab = async (sessione_id: string) => {
    const idx = sessioni.findIndex((s) => s.id === sessione_id);
    try {
      await elimina_sessione.mutateAsync(sessione_id);
      if (tab_attivo === sessione_id) {
        const vicina = sessioni[idx - 1] ?? sessioni.find((s) => s.id !== sessione_id);
        set_tab_attivo(vicina ? vicina.id : null);
      }
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  // Mantiene sempre un tab valido selezionato
  useEffect(() => {
    if (sessioni.length === 0) {
      if (tab_attivo !== null) set_tab_attivo(null);
      return;
    }
    if (!tab_attivo || !sessioni.some((s) => s.id === tab_attivo)) {
      set_tab_attivo(sessioni[0].id);
    }
  }, [sessioni, tab_attivo]);

  const conferma_ripetizione = async (fino_a: string) => {
    if (!ripeti_sessione) return;
    try {
      const res = await ripeti.mutateAsync({
        sessione: ripeti_sessione,
        blocco,
        fino_a,
        nome_risorsa: risorsa_blocco?.nome ?? null,
      });
      const parti = [
        `${res.settimane_create} ${res.settimane_create === 1 ? "settimana creata" : "settimane create"}`,
      ];
      if (res.settimane_esistenti > 0) parti.push(`${res.settimane_esistenti} già esistenti`);
      toast({
        title: "🔁 Ricorrenza aggiornata",
        description: res.corso_creato
          ? `${parti.join(", ")}. Corso "${res.corso_nome}" creato — imposta il prezzo in Corsi.`
          : parti.join(", "),
      });
      set_ripeti_sessione(null);
    } catch (e: any) {
      toast({ title: "Errore ricorrenza", description: e?.message, variant: "destructive" });
    }
  };

  const salva_sessione = async (
    s: GrigliaSessione,
    patch: Partial<GrigliaSessione>,
    forzatura?: string,
  ) => {
    const merged = { ...s, ...patch };

    // Controllo disponibilità solo quando cambia l'orario (il resto resta invariato).
    const cambia_orario = patch.ora_inizio !== undefined || patch.ora_fine !== undefined;
    if (cambia_orario && !forzatura) {
      const check = verifica_orario_disponibilita({
        fasce_ghiaccio,
        fasce_pulizia,
        ora_inizio: hhmm(merged.ora_inizio),
        ora_fine: hhmm(merged.ora_fine),
        giorno: giorno_blocco ?? undefined,
        is_ospite: !!risorsa_blocco?.is_ospite,

      });
      if (!check.ok) {
        set_motivo_blocco(check.motivo ?? null);
        set_pending_patch({ sessione: s, patch });
        set_forzatura_open(true);
        return;
      }
    }

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
        pista: merged.pista,
        messaggio_atleti: merged.messaggio_atleti,
        ...(forzatura ? { fuori_disponibilita: true, motivo_forzatura: forzatura } : {}),
      });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const conferma_forzatura_sessione = async (motivo_forzatura: string) => {
    const pend = pending_patch;
    set_forzatura_open(false);
    set_pending_patch(null);
    if (!pend) return;
    await salva_sessione(pend.sessione, pend.patch, motivo_forzatura);
  };

  // Riepilogo destinatari pre-pubblicazione (aggiornato mentre si lavora)
  const riepilogo_invio = useMemo(() => {
    const atleti_map = new Map<string, string>();
    let convocazioni = 0;
    for (const s of sessioni) {
      const testo = (s.messaggio_atleti ?? "").trim();
      if (!testo) continue;
      for (const a of s.atleti ?? []) {
        convocazioni += 1;
        atleti_map.set(a.atleta_id, `${a.nome} ${a.cognome}`.trim());
      }
    }
    const ist_con = new Map<string, string>();
    const ist_senza = new Map<string, string>();
    for (const s of sessioni) {
      for (const i of s.istruttori ?? []) {
        const nome = `${i.nome} ${i.cognome}`.trim() || i.istruttore_id.slice(0, 8);
        if (i.user_id) ist_con.set(i.istruttore_id, nome);
        else ist_senza.set(i.istruttore_id, nome);
      }
    }
    return {
      convocazioni,
      atleti: Array.from(atleti_map.values()).sort((a, b) => a.localeCompare(b, "it")),
      istruttori: Array.from(ist_con.values()).sort((a, b) => a.localeCompare(b, "it")),
      istruttori_senza_account: Array.from(ist_senza.values()).sort((a, b) => a.localeCompare(b, "it")),
    };
  }, [sessioni]);

  const handle_pubblica = async () => {
    try {
      // Sync automatico dei gruppi collegati prima dell'invio (non bloccante per sessione)
      const con_gruppo = sessioni.filter((s) => !!s.gruppo_livello);
      const falliti: string[] = [];
      for (const s of con_gruppo) {
        try {
          await sync_gruppo_core(s);
        } catch {
          falliti.push(`${hhmm(s.ora_inizio)}–${hhmm(s.ora_fine)}`);
        }
      }
      if (falliti.length > 0) {
        toast({
          title: "Alcuni gruppi non sincronizzati",
          description: `Sessioni: ${falliti.join(", ")}. Pubblico con i dati attuali.`,
          variant: "destructive",
        });
      }
      const res = await pubblica.mutateAsync(blocco);

      const n = res?.inviate ?? 0;
      const ni = res?.istruttori_avvisati ?? 0;
      const ns = res?.istruttori_senza_account ?? 0;
      const parti = [`${n} convocazioni agli atleti`, `${ni} istruttori avvisati`];
      if (ns > 0) parti.push(`${ns} istruttori senza account collegato`);
      toast({ title: "✅ Griglia pubblicata", description: parti.join(" · ") });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra azioni */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-2">
          {blocco.stato === "pubblicato" ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Pubblicato{blocco.pubblicato_at ? ` il ${new Date(blocco.pubblicato_at).toLocaleDateString("it-CH")}` : ""}
            </Badge>
          ) : (
            <>
              <button
                type="button"
                onClick={() => set_riepilogo_aperto((v) => !v)}
                className="text-xs text-left text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Invierai: {riepilogo_invio.convocazioni} convocazioni a {riepilogo_invio.atleti.length} atleti ·{" "}
                {riepilogo_invio.istruttori.length} istruttori avvisati
                {riepilogo_invio.istruttori_senza_account.length > 0
                  ? ` · ${riepilogo_invio.istruttori_senza_account.length} istruttori senza account collegato (non riceveranno nulla)`
                  : ""}
              </button>
              {riepilogo_aperto && (
                <div className="text-xs text-muted-foreground border rounded-lg p-2 space-y-1 max-w-xl">
                  <p>
                    <span className="font-medium text-foreground">Atleti:</span>{" "}
                    {riepilogo_invio.atleti.join(", ") || "nessuno"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Istruttori:</span>{" "}
                    {riepilogo_invio.istruttori.join(", ") || "nessuno"}
                  </p>
                  {riepilogo_invio.istruttori_senza_account.length > 0 && (
                    <p>
                      <span className="font-medium text-foreground">Senza account collegato:</span>{" "}
                      {riepilogo_invio.istruttori_senza_account.join(", ")}
                    </p>
                  )}
                </div>
              )}
              <Button size="sm" onClick={handle_pubblica} disabled={pubblica.isPending}>
                <Send className="w-4 h-4 mr-1" /> Pubblica e invia convocazioni
              </Button>
            </>
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
          <PoolBox box_id="esterni" titolo="Esterni" items={pool_esterni} prefisso="atleta" colore={VERDE_ESTERNI} />
          <PoolBox titolo="Istruttori" items={pool_istruttori} prefisso="istruttore" variante_istruttori />
        </div>

        {/* Fascia inferiore: sotto-sessioni a tab */}
        <div className="mt-4">
          {sessioni.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Nessuna sotto-sessione. Aggiungine una per iniziare.</p>
              <Button variant="outline" size="sm" onClick={aggiungi_sessione}>
                <Plus className="w-4 h-4 mr-1" /> Aggiungi sotto-sessione
              </Button>
            </div>
          ) : (
            <Tabs value={tab_attivo ?? sessioni[0].id} onValueChange={set_tab_attivo} className="w-full">
              <div className="flex items-center gap-2">
                <div className="overflow-x-auto flex-1">
                  <TabsList className="inline-flex w-max">
                    {sessioni.map((s) => {
                      const pieno = (s.atleti?.length ?? 0) > 0 || (s.istruttori?.length ?? 0) > 0;
                      return (
                        <TabsTrigger key={s.id} value={s.id} className="gap-2 whitespace-nowrap">
                          <span>
                            {hhmm(s.ora_inizio)}–{hhmm(s.ora_fine)}
                          </span>
                          <span
                            className={cn(
                              "inline-block w-2 h-2 rounded-full",
                              pieno ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                          />
                          {s.corso_id && <Repeat className="w-3.5 h-3.5 text-primary" />}
                          {s.fuori_disponibilita && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {s.motivo_forzatura || "Orario fuori dalla disponibilità dichiarata"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={aggiungi_sessione}
                  title="Aggiungi sotto-sessione"
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {sessioni.map((s) => (
                <TabsContent key={s.id} value={s.id} className="mt-3">
                  <SessioneBox
                    sessione={s}
                    specialita={specialita as any[]}
                    on_change={(patch) => salva_sessione(s, patch)}
                    on_elimina={() => elimina_sessione_tab(s.id)}
                    on_rimuovi_atleta={(atleta_id) => rimuovi_atleta.mutateAsync({ sessione_id: s.id, atleta_id })}
                    on_rimuovi_istruttore={(istruttore_id) =>
                      rimuovi_istruttore.mutateAsync({ sessione_id: s.id, istruttore_id })
                    }
                    on_ripeti={() => set_ripeti_sessione(s)}
                    on_sync_gruppo={() => sincronizza_dal_gruppo(s)}
                    on_rimuovi_gruppo={() => rimuovi_collegamento_gruppo(s)}

                    sync_in_corso={sync_gruppo_id === s.id}
                    data_blocco={blocco.data}
                    atleti_tutti={atleti as any[]}
                    ragioni_sociali={ragioni_attive}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </DndContext>

      <ConfermaForzaturaDisponibilita
        open={forzatura_open}
        motivo={motivo_blocco}
        orario_label={
          pending_patch
            ? `${hhmm(pending_patch.patch.ora_inizio ?? pending_patch.sessione.ora_inizio)}–${hhmm(
                pending_patch.patch.ora_fine ?? pending_patch.sessione.ora_fine,
              )}`
            : undefined
        }
        on_close={() => {
          set_forzatura_open(false);
          set_pending_patch(null);
        }}
        on_forza={conferma_forzatura_sessione}
      />

      <RipetiSessioneDialog
        open={!!ripeti_sessione}
        on_close={() => set_ripeti_sessione(null)}
        giorno={giorno_it_da_data(blocco.data)}
        data_blocco={blocco.data}
        gia_ricorrente={!!ripeti_sessione?.corso_id}
        in_corso={ripeti.isPending}
        on_conferma={conferma_ripetizione}
      />

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
