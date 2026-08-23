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
  use_assegna_gruppo_sessione,
  use_rimuovi_gruppo_sessione,
  use_sync_gruppo_sessione,
  risolvi_membri_gruppo,
  verifica_conflitto_gruppo,
  verifica_conflitto_atleta,
  verifica_conflitto_istruttore,

  type ConflittoGruppo,

  giorno_it_da_data,
  type GruppoScope,
  type GrigliaBlocco,
  type GrigliaSessione,
  type GrigliaSessioneGruppo,
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
import NuovaPropostaDialog, { type ConfermaProposta } from "@/components/griglia/NuovaPropostaDialog";
import { use_pool_proposte, use_crea_proposta } from "@/hooks/use-proposte";
import { Link as RouterLink } from "react-router-dom";
import { verifica_orario_disponibilita } from "@/lib/availability";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Settings, Plus, Trash2, X, GraduationCap, Send, CheckCircle2, GripVertical, HelpCircle, ChevronDown, ChevronRight, AlertTriangle, Repeat, Link2, RefreshCw, Package } from "lucide-react";

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

// ─── Box pool "per proposta" ───────────────────────────────
const PoolPropostaBox: React.FC<{
  proposta_id: string;
  titolo: string;
  items: { id: string; nome: string; cognome: string }[];
}> = ({ proposta_id, titolo, items }) => {
  const [aperto, set_aperto] = useState(true);
  const vuoto = items.length === 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `gruppo:proposta:${proposta_id}`,
    disabled: vuoto,
    data: { tipo: "gruppo", atleta_ids: items.map((i) => i.id), individuale: true, etichetta: titolo },
  });

  return (
    <div className="rounded-xl border p-3 flex flex-col gap-2 bg-muted/20 border-border">
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
          <Package className="w-4 h-4 text-primary" />
          <span className="truncate">{titolo}</span>
        </h4>
        <Badge variant="secondary" className="text-[10px] shrink-0">{items.length}</Badge>
      </button>

      {vuoto ? (
        <p className="text-xs text-muted-foreground">
          0 iscritti ·{" "}
          <RouterLink to="/corsi" className="underline underline-offset-2">
            Gestisci adesioni
          </RouterLink>
        </p>
      ) : (
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          title={`Trascina tutta la proposta «${titolo}» (${items.length} iscritti)`}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30",
            "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
            "cursor-grab active:cursor-grabbing select-none",
            isDragging && "opacity-40",
          )}
        >
          <GripVertical className="w-3 h-3 shrink-0" />
          <span className="truncate">Iscritti</span>
          <span className="ml-auto text-[10px] font-normal">· {items.length}</span>
        </div>
      )}

      {aperto && !vuoto && (
        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
          {items.map((i) => (
            <PillolaDraggable
              key={i.id}
              drag_id={`atleta:${i.id}`}
              label={`${i.nome} ${i.cognome}`}
              sigla={iniziali(i.nome, i.cognome)}
            />
          ))}
        </div>
      )}
    </div>
  );
};




// ─── Pillola di un gruppo agganciato alla sotto-sessione ───
const GruppoPill: React.FC<{
  gruppo: GrigliaSessioneGruppo;
  n_atleti: number;
  salvati_ids: string[];
  nome_atleta: (atleta_id: string) => string;
  colore: string | null;
  in_sync?: boolean;
  on_sync?: () => void;
  on_rimuovi?: () => void;
}> = ({ gruppo, n_atleti, salvati_ids, nome_atleta, colore, in_sync, on_sync, on_rimuovi }) => {
  const [open, set_open] = useState(false);
  const [membri_live, set_membri_live] = useState<string[] | null>(null);
  const [loading, set_loading] = useState(false);
  const [conferma, set_conferma] = useState(false);

  const carica = async () => {
    set_loading(true);
    try {
      const ids = await risolvi_membri_gruppo(
        get_current_club_id(),
        gruppo.gruppo_scope,
        gruppo.gruppo_livello,
        gruppo.gruppo_ragione_sociale_id,
      );
      set_membri_live(ids);
    } catch {
      set_membri_live(null);
    } finally {
      set_loading(false);
    }
  };

  const nuovi = (membri_live ?? []).filter((id) => !salvati_ids.includes(id));
  const usciti = membri_live ? salvati_ids.filter((id) => !membri_live.includes(id)) : [];

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(v) => {
          set_open(v);
          if (v) void carica();
        }}
      >
        <PopoverTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            onMouseEnter={() => {
              set_open(true);
              void carica();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer",
              colore ? "border-border" : "border-border bg-background",
            )}
            style={colore ? { borderLeft: `3px solid ${colore}`, backgroundColor: `${colore}1A` } : undefined}
          >
            <Link2 className="w-3 h-3" />
            <span className="font-medium">{gruppo.gruppo_livello}</span>
            <span className="text-muted-foreground">· {n_atleti} atleti</span>
            {on_sync && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  on_sync();
                }}
                disabled={in_sync}
                aria-label="Aggiorna dal gruppo"
                title="Aggiorna dal gruppo"
              >
                <RefreshCw className={cn("w-3 h-3 text-muted-foreground", in_sync && "animate-spin")} />
              </button>
            )}
            {on_rimuovi && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  set_conferma(true);
                }}
                aria-label="Rimuovi collegamento al gruppo"
              >
                <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 text-xs" onMouseLeave={() => set_open(false)}>
          <p className="font-semibold mb-1">Membri attuali del gruppo</p>
          {loading && <p className="text-muted-foreground">Caricamento…</p>}
          {!loading && (
            <ul className="space-y-0.5 max-h-48 overflow-y-auto">
              {(membri_live ?? salvati_ids).map((id) => (
                <li key={id} className="flex items-center gap-1">
                  {nuovi.includes(id) && <span className="text-amber-600">★</span>}
                  {nome_atleta(id)}
                </li>
              ))}
              {(membri_live ?? salvati_ids).length === 0 && (
                <li className="text-muted-foreground">Nessun atleta nel gruppo.</li>
              )}
            </ul>
          )}
          {!loading && membri_live && (nuovi.length > 0 || usciti.length > 0) && (
            <p className="mt-2 pt-2 border-t text-amber-700">
              {nuovi.length > 0 && `★ ${nuovi.length} nuovi non ancora sincronizzati`}
              {nuovi.length > 0 && usciti.length > 0 && " · "}
              {usciti.length > 0 && `${usciti.length} non più nel gruppo`}
              {" — usa «Aggiorna dal gruppo»."}
            </p>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={conferma} onOpenChange={set_conferma}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere il collegamento al gruppo?</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno rimossi i {n_atleti} atleti provenienti dal gruppo «{gruppo.gruppo_livello}». Gli atleti
              aggiunti manualmente e gli altri gruppi restano invariati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                set_conferma(false);
                on_rimuovi?.();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rimuovi gruppo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  on_proposta?: () => void;
  on_sync_gruppo?: (gruppo_sessione_id: string) => void;
  on_rimuovi_gruppo?: (gruppo_sessione_id: string) => void;
  sync_gruppo_ids?: string[];
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
  on_proposta,
  on_sync_gruppo,
  on_rimuovi_gruppo,
  sync_gruppo_ids,

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
  const prefill_fatto = React.useRef(false);

  React.useEffect(() => {
    set_messaggio(sessione.messaggio_atleti ?? "");
  }, [sessione.messaggio_atleti]);

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

  const nome_atleta = (atleta_id: string): string => {
    const salvato = (sessione.atleti ?? []).find((a) => a.atleta_id === atleta_id);
    if (salvato) return `${salvato.nome ?? ""} ${salvato.cognome ?? ""}`.trim() || atleta_id.slice(0, 8);
    const a = atleti_tutti.find((x) => x.id === atleta_id);
    return `${a?.nome ?? ""} ${a?.cognome ?? ""}`.trim() || atleta_id.slice(0, 8);
  };





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
                {sessione.proposta_nome
                  ? `Proposta: ${sessione.proposta_nome} — collegata al corso: ${sessione.corso_nome ?? "corso ricorrente"}`
                  : `Collegata al corso: ${sessione.corso_nome ?? "corso ricorrente"}`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {(sessione.gruppi ?? []).length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Link2 className="w-3 h-3" />
                  {(sessione.gruppi ?? []).length === 1
                    ? `Gruppo: ${sessione.gruppi[0].gruppo_livello}`
                    : `${sessione.gruppi.length} gruppi collegati`}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Collegata dinamicamente a: {(sessione.gruppi ?? []).map((g) => g.gruppo_livello).join(", ")}.
                Usa «Aggiorna dal gruppo» su ciascuna pillola per riallineare gli atleti.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {on_proposta && !sessione.corso_id && (
          <Button
            variant="ghost"
            size="icon"
            onClick={on_proposta}
            title="Crea proposta da questa sessione"
          >
            <Package className="w-4 h-4" />
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
        {(sessione.gruppi ?? []).map((g) => (
          <GruppoPill
            key={g.id}
            gruppo={g}
            n_atleti={(sessione.atleti ?? []).filter((a) => a.gruppo_sessione_id === g.id).length}
            salvati_ids={(sessione.atleti ?? [])
              .filter((a) => a.gruppo_sessione_id === g.id)
              .map((a) => a.atleta_id)}
            nome_atleta={nome_atleta}
            colore={
              (g.gruppo_scope === "esterni" ? VERDE_ESTERNI : null) ||
              (g.gruppo_ragione_sociale_id
                ? ragioni_sociali.find((r) => r.id === g.gruppo_ragione_sociale_id)?.colore_primario ?? null
                : null)
            }
            in_sync={!!sync_gruppo_ids?.includes(g.id)}
            on_sync={on_sync_gruppo ? () => on_sync_gruppo(g.id) : undefined}
            on_rimuovi={on_rimuovi_gruppo ? () => on_rimuovi_gruppo(g.id) : undefined}
          />
        ))}
        {atleti_ordinati
          .filter((a) => !a.gruppo_sessione_id)
          .map((a) => {
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
          })}


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
  const assegna_gruppo = use_assegna_gruppo_sessione();
  const rimuovi_gruppo = use_rimuovi_gruppo_sessione();
  const sync_gruppo = use_sync_gruppo_sessione();

  const [open_specialita, set_open_specialita] = useState(false);
  const [riepilogo_aperto, set_riepilogo_aperto] = useState(false);
  const [tab_attivo, set_tab_attivo] = useState<string | null>(null);
  const [forzatura_open, set_forzatura_open] = useState(false);
  const [motivo_blocco, set_motivo_blocco] = useState<string | null>(null);
  const [pending_patch, set_pending_patch] = useState<
    { sessione: GrigliaSessione; patch: Partial<GrigliaSessione> } | null
  >(null);
  const [ripeti_sessione, set_ripeti_sessione] = useState<GrigliaSessione | null>(null);
  const [sync_gruppo_ids, set_sync_gruppo_ids] = useState<string[]>([]);
  const [conflitto_gruppo, set_conflitto_gruppo] = useState<
    { livello: string; conflitto: ConflittoGruppo } | null
  >(null);
  const [conflitto_atleta, set_conflitto_atleta] = useState<
    { nome: string; conflitto: ConflittoGruppo } | null
  >(null);
  const [conflitto_istruttore, set_conflitto_istruttore] = useState<
    { nome: string; istruttore_id: string; sessione_id: string; conflitto: ConflittoGruppo } | null
  >(null);



  /** Riallinea SOLO gli atleti taggati con quel gruppo alla membership attuale. */
  const sincronizza_gruppo = async (s: GrigliaSessione, gruppo_sessione_id: string) => {
    const g = (s.gruppi ?? []).find((x) => x.id === gruppo_sessione_id);
    if (!g) return;
    set_sync_gruppo_ids((v) => [...v, gruppo_sessione_id]);
    try {
      const { da_aggiungere, da_rimuovere } = await sync_gruppo.mutateAsync({
        gruppo_sessione_id,
        sessione_id: s.id,
        gruppo: g,
      });
      toast({
        title: `Gruppo «${g.gruppo_livello}» aggiornato`,
        description:
          da_aggiungere === 0 && da_rimuovere === 0
            ? "Nessuna variazione: già allineato."
            : `+${da_aggiungere} aggiunti, −${da_rimuovere} rimossi.`,
      });
    } catch (e: any) {
      toast({ title: "Errore aggiornamento gruppo", description: e.message, variant: "destructive" });
    } finally {
      set_sync_gruppo_ids((v) => v.filter((x) => x !== gruppo_sessione_id));
    }
  };

  /** Sgancia un gruppo: rimuove solo gli atleti che ne provengono. */
  const rimuovi_collegamento_gruppo = async (gruppo_sessione_id: string) => {
    try {
      await rimuovi_gruppo.mutateAsync(gruppo_sessione_id);
      toast({ title: "Collegamento rimosso", description: "Gli atleti di quel gruppo sono stati rimossi." });
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
        const livello_gruppo: string | undefined = active.data?.current?.livello;
        if (livello_gruppo && livello_gruppo !== LIVELLO_NON_DEFINITO) {
          // Collegamento dinamico: nuova riga in griglia_sessioni_gruppi + atleti taggati.
          const { gruppo_scope, gruppo_ragione_sociale_id } = scope_da_box_id(active.data?.current?.box_id);

          const scope_norm = (gruppo_scope ?? "club") as GruppoScope;

          // ℹ️ Stesso gruppo già collegato a QUESTA sessione: non duplichiamo,
          // trattiamo il drag come risincronizzazione.
          const gia_collegato = (dest.gruppi ?? []).find(
            (g) =>
              g.gruppo_livello === livello_gruppo &&
              g.gruppo_scope === scope_norm &&
              (g.gruppo_ragione_sociale_id ?? null) === (gruppo_ragione_sociale_id ?? null),
          );

          // ⛔ Controllo BLOCCANTE (nessuna scrittura se lo stesso gruppo è già
          // collegato a un'altra sotto-sessione sovrapposta nello stesso giorno).
          if (!gia_collegato) {
            const conflitto = await verifica_conflitto_gruppo({
              sessione_id,
              gruppo_livello: livello_gruppo,
              gruppo_scope: scope_norm,
              gruppo_ragione_sociale_id,
            });
            if (conflitto) {
              set_conflitto_gruppo({ livello: livello_gruppo, conflitto });
              return;
            }
          }

          const res = await assegna_gruppo.mutateAsync({
            sessione_id,
            gruppo_livello: livello_gruppo,
            gruppo_scope: scope_norm,
            gruppo_ragione_sociale_id,
          });
          for (const atleta_id of ids) {
            const a = (atleti as any[]).find((x) => x.id === atleta_id);
            const nome = a ? `${a.nome} ${a.cognome}` : "Atleta";
            avvisa_sovrapposizione("atleta", atleta_id, nome, dest);
          }
          if (gia_collegato || (res as any).gia_presente) {
            toast({
              title: `ℹ️ Il gruppo «${livello_gruppo}» è già collegato a questa sessione`,
              description: "Membership risincronizzata.",
            });
          } else {
            toast({ title: `🔗 Gruppo «${livello_gruppo}» collegato`, description: `${res.aggiunti} atleti aggiunti.` });
          }

        } else {
          // Livello non definito: nessun gruppo dinamico, assegnazione individuale.
          let assegnati = 0;
          for (const atleta_id of ids) {
            const a = (atleti as any[]).find((x) => x.id === atleta_id);
            const nome = a ? `${a.nome} ${a.cognome}` : "Atleta";
            // ⛔ Controllo BLOCCANTE per singolo atleta.
            const conflitto = await verifica_conflitto_atleta({ sessione_id, atleta_id });
            if (conflitto) {
              set_conflitto_atleta({ nome, conflitto });
              return;
            }
            await assegna_atleta.mutateAsync({ sessione_id, atleta_id });
            assegnati += 1;
          }
          if (assegnati > 0) toast({ title: `✅ ${assegnati} atleti assegnati alla sessione` });
        }


      } else if (tipo === "atleta") {
        const a = (atleti as any[]).find((x) => x.id === persona_id);
        const nome = a ? `${a.nome} ${a.cognome}` : "Atleta";
        // ⛔ Controllo BLOCCANTE: nessuna mutation se già in sessione sovrapposta.
        const conflitto = await verifica_conflitto_atleta({ sessione_id, atleta_id: persona_id });
        if (conflitto) {
          set_conflitto_atleta({ nome, conflitto });
          return;
        }
        await assegna_atleta.mutateAsync({ sessione_id, atleta_id: persona_id });
      } else if (tipo === "istruttore") {
        const i = (istruttori as any[]).find((x) => x.id === persona_id);
        const nome = i ? `${i.nome} ${i.cognome}` : "Istruttore";
        // ⚠️ Blocco di default, ma sbloccabile manualmente dall'utente.
        const conflitto = await verifica_conflitto_istruttore({ sessione_id, istruttore_id: persona_id });
        if (conflitto) {
          set_conflitto_istruttore({ nome, istruttore_id: persona_id, sessione_id, conflitto });
          return;
        }
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
      // Sync automatico di TUTTI i gruppi collegati prima dell'invio (non bloccante)
      const falliti: string[] = [];
      for (const s of sessioni) {
        for (const g of s.gruppi ?? []) {
          try {
            await sync_gruppo.mutateAsync({ gruppo_sessione_id: g.id, sessione_id: s.id, gruppo: g });
          } catch {
            falliti.push(`${hhmm(s.ora_inizio)}–${hhmm(s.ora_fine)} (${g.gruppo_livello})`);
          }
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
                    on_sync_gruppo={(gid) => sincronizza_gruppo(s, gid)}
                    on_rimuovi_gruppo={(gid) => rimuovi_collegamento_gruppo(gid)}

                    sync_gruppo_ids={sync_gruppo_ids}

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

      <AlertDialog open={!!conflitto_gruppo} onOpenChange={(o) => !o && set_conflitto_gruppo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⛔ Gruppo già assegnato in questo orario</AlertDialogTitle>
            <AlertDialogDescription>
              Il gruppo «{conflitto_gruppo?.livello}» è già assegnato a un'altra sessione sovrapposta (
              {conflitto_gruppo?.conflitto.ora_inizio}–{conflitto_gruppo?.conflitto.ora_fine} —{" "}
              {conflitto_gruppo?.conflitto.etichetta}). Lo stesso gruppo non può essere in due sessioni
              contemporanee: rimuovi prima l'altro collegamento oppure cambia l'orario della sessione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => set_conflitto_gruppo(null)}>Ho capito</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!conflitto_atleta} onOpenChange={(o) => !o && set_conflitto_atleta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⛔ Atleta già assegnato in questo orario</AlertDialogTitle>
            <AlertDialogDescription>
              {conflitto_atleta?.nome} è già assegnato a un'altra sessione sovrapposta (
              {conflitto_atleta?.conflitto.ora_inizio}–{conflitto_atleta?.conflitto.ora_fine} —{" "}
              {conflitto_atleta?.conflitto.etichetta}). Lo stesso atleta non può essere in due sessioni
              contemporanee: rimuovilo prima dall'altra sessione oppure cambia l'orario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => set_conflitto_atleta(null)}>Ho capito</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!conflitto_istruttore} onOpenChange={(o) => !o && set_conflitto_istruttore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Istruttore già assegnato in questo orario</AlertDialogTitle>
            <AlertDialogDescription>
              {conflitto_istruttore?.nome} è già assegnato a un'altra sessione sovrapposta (
              {conflitto_istruttore?.conflitto.ora_inizio}–{conflitto_istruttore?.conflitto.ora_fine} —{" "}
              {conflitto_istruttore?.conflitto.etichetta}). Puoi assegnarlo comunque se deve seguire
              eccezionalmente due gruppi in contemporanea.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const c = conflitto_istruttore;
                set_conflitto_istruttore(null);
                if (!c) return;
                try {
                  await assegna_istruttore.mutateAsync({
                    sessione_id: c.sessione_id,
                    istruttore_id: c.istruttore_id,
                    forza: true,
                  });
                  toast({ title: `✅ ${c.nome} assegnato nonostante la sovrapposizione` });
                } catch (e: any) {
                  toast({ title: "Errore assegnazione", description: e.message, variant: "destructive" });
                }
              }}
            >
              Assegna comunque
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



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
        <DialogContent className="max-h-[85vh] flex flex-col overflow-hidden">
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
