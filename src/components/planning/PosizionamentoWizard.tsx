// ─────────────────────────────────────────────────────────────
// Wizard guidato a 3 passi per posizionare un corso nel planning.
// Passo 1: scegli il corso da posizionare (con ricerca).
// Passo 2: scegli lo slot — solo fasce ghiaccio compatibili, con
//          indicazione di quanti istruttori sono liberi in quel momento.
// Passo 3: scegli l'istruttore — disponibili in cima, gli altri in
//          fondo (selezionabili ma segnalati come fuori disponibilità).
// ─────────────────────────────────────────────────────────────
import React, { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Search, X, Loader2, AlertTriangle, Snowflake, Users, Clock } from "lucide-react";
import {
  time_to_min,
  norm_giorno,
  calcola_status_istruttori_per_slot,
  type planning_slot_per_conflitto,
} from "@/lib/availability";

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const OFF_ICE_TYPES = ["off-ice", "off ice", "office", "palestra", "danza"];
const STEP_LABELS = ["Corso", "Slot", "Istruttore"];

function min_to_hhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function is_off_ice(c: any): boolean {
  if (c?.usa_ghiaccio === false) return true;
  if (c?.usa_ghiaccio === true) return false;
  return OFF_ICE_TYPES.includes((c?.tipo || "").toLowerCase());
}

export type slot_candidato = {
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
  /** Corsi già presenti che si sovrappongono a questo slot */
  sovrapposti: number;
  /** Istruttori la cui disponibilità copre interamente lo slot e che sono liberi */
  istruttori_liberi: number;
};

export type posizionamento_wizard_props = {
  open: boolean;
  on_close: () => void;
  /** Corsi senza collocazione (giorno/ora mancanti) */
  corsi_da_posizionare: any[];
  /** Righe di disponibilita_ghiaccio (tipo ghiaccio + pulizia) */
  slots: any[];
  /** Corsi già posizionati nella settimana corrente (display format) */
  posizionati: any[];
  /** Istruttori del club, con campo `disponibilita` per giorno */
  istruttori: any[];
  saving?: boolean;
  on_place: (
    corso: any,
    giorno: string,
    ora_inizio: string,
    ora_fine: string,
    istruttore_id: string | null,
  ) => void | Promise<void>;
};

export function PosizionamentoWizard(props: posizionamento_wizard_props) {
  const { open, on_close, corsi_da_posizionare, slots, posizionati, istruttori, saving, on_place } = props;

  const [step, set_step] = useState(1);
  const [q_corso, set_q_corso] = useState("");
  const [corso, set_corso] = useState<any>(null);
  const [durata, set_durata] = useState(60);
  const [slot, set_slot] = useState<slot_candidato | null>(null);
  const [istruttore_id, set_istruttore_id] = useState<string | null>(null);

  const reset = () => {
    set_step(1); set_q_corso(""); set_corso(null);
    set_durata(60); set_slot(null); set_istruttore_id(null);
  };

  const close = () => { reset(); on_close(); };

  const istruttori_attivi = useMemo(
    () => (istruttori ?? []).filter((i: any) => i.attivo !== false),
    [istruttori],
  );

  // ── Corsi filtrati (passo 1) ──
  const corsi_filtrati = useMemo(() => {
    const q = q_corso.trim().toLowerCase();
    const list = corsi_da_posizionare ?? [];
    if (!q) return list;
    return list.filter((c: any) =>
      `${c.nome ?? ""} ${c.tipo ?? ""} ${c.livello_richiesto ?? ""}`.toLowerCase().includes(q),
    );
  }, [corsi_da_posizionare, q_corso]);

  const off_ice = corso ? is_off_ice(corso) : false;

  // ── Slot candidati (passo 2) ──
  const slot_per_giorno = useMemo(() => {
    const out: Record<string, slot_candidato[]> = {};
    if (!corso) return out;

    const occupati_per_giorno: Record<string, { s: number; e: number }[]> = {};
    (posizionati ?? []).forEach((c: any) => {
      if (c.annullato) return;
      if (!c.giorno) return;
      const g = norm_giorno(c.giorno);
      (occupati_per_giorno[g] ||= []).push({
        s: time_to_min((c.ora_inizio || "").slice(0, 5)),
        e: time_to_min((c.ora_fine || "").slice(0, 5)),
      });
    });

    GIORNI.forEach((giorno) => {
      const g = norm_giorno(giorno);
      // Fasce base: ghiaccio dichiarato, oppure finestra standard per off-ice
      const fasce: { s: number; e: number }[] = off_ice
        ? [{ s: 8 * 60, e: 21 * 60 }]
        : (slots ?? [])
            .filter((sl: any) => norm_giorno(sl.giorno) === g && (sl.tipo ?? "ghiaccio") === "ghiaccio")
            .map((sl: any) => ({ s: time_to_min(sl.ora_inizio), e: time_to_min(sl.ora_fine) }));

      const pulizia = (slots ?? [])
        .filter((sl: any) => norm_giorno(sl.giorno) === g && sl.tipo === "pulizia")
        .map((sl: any) => ({ s: time_to_min(sl.ora_inizio), e: time_to_min(sl.ora_fine) }));

      const candidati: slot_candidato[] = [];
      fasce.forEach((f) => {
        for (let s = f.s; s + durata <= f.e; s += 15) {
          const e = s + durata;
          // scarta se interseca una fascia di pulizia
          if (pulizia.some((p) => p.s < e && p.e > s)) continue;

          const sovrapposti = (occupati_per_giorno[g] ?? []).filter((o) => o.s < e && o.e > s).length;

          const status = calcola_status_istruttori_per_slot({
            istruttori: istruttori_attivi,
            giorno,
            ora_inizio: min_to_hhmm(s),
            ora_fine: min_to_hhmm(e),
            planning_slots: build_planning_slots(posizionati, giorno),
            corso_id_corrente: corso.corso_id || corso.id,
          });
          const istruttori_liberi = status.filter((x) => x.disponibile).length;

          candidati.push({
            giorno,
            ora_inizio: min_to_hhmm(s),
            ora_fine: min_to_hhmm(e),
            sovrapposti,
            istruttori_liberi,
          });
        }
      });
      if (candidati.length) out[giorno] = candidati;
    });

    return out;
  }, [corso, off_ice, slots, posizionati, durata, istruttori_attivi]);

  const nessuno_slot = Object.keys(slot_per_giorno).length === 0;

  // ── Istruttori per lo slot scelto (passo 3) ──
  const status_istruttori = useMemo(() => {
    if (!slot) return [];
    return calcola_status_istruttori_per_slot({
      istruttori: istruttori_attivi,
      giorno: slot.giorno,
      ora_inizio: slot.ora_inizio,
      ora_fine: slot.ora_fine,
      planning_slots: build_planning_slots(posizionati, slot.giorno),
      corso_id_corrente: corso?.corso_id || corso?.id || null,
    });
  }, [slot, istruttori_attivi, posizionati, corso]);

  const disponibili = status_istruttori.filter((s) => s.disponibile);
  const non_disponibili = status_istruttori.filter((s) => !s.disponibile);

  const conferma = async () => {
    if (!corso || !slot) return;
    await on_place(corso, slot.giorno, slot.ora_inizio, slot.ora_fine, istruttore_id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Posizionamento guidato</DialogTitle>
          <DialogDescription>
            Passo {step} di 3 · {STEP_LABELS[step - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <span className={`text-xs ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {idx < STEP_LABELS.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q_corso}
                onChange={(e) => set_q_corso(e.target.value)}
                placeholder="Cerca corso per nome, tipo o livello…"
                className="pl-8 pr-8 h-11"
              />
              {q_corso && (
                <button
                  type="button"
                  onClick={() => set_q_corso("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label="Cancella ricerca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {corsi_filtrati.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nessun corso da posizionare.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {corsi_filtrati.map((c: any) => {
                  const sel = corso?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        set_corso(c);
                        const d =
                          c.ora_inizio && c.ora_fine
                            ? time_to_min(c.ora_fine) - time_to_min(c.ora_inizio)
                            : 60;
                        set_durata(d > 0 ? d : 60);
                        set_slot(null);
                        set_istruttore_id(null);
                      }}
                      className={`text-left rounded-lg border p-3 transition-colors min-h-[64px] ${
                        sel ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{c.nome}</span>
                        {sel && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {is_off_ice(c) ? "Off-Ice" : "Ghiaccio"}
                        </Badge>
                        {c.livello_richiesto && (
                          <span className="text-[10px] text-muted-foreground">{c.livello_richiesto}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && corso && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">Durata</span>
              <div className="flex gap-1.5">
                {[30, 45, 60, 75, 90, 120].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { set_durata(d); set_slot(null); }}
                    className={`px-3 h-9 rounded-md border text-xs font-medium ${
                      durata === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {d}′
                  </button>
                ))}
              </div>
            </div>

            {nessuno_slot ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Nessuno slot compatibile con una durata di {durata} minuti. Riduci la durata oppure aggiungi
                  fasce di ghiaccio nelle disponibilità del club.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {GIORNI.filter((g) => slot_per_giorno[g]?.length).map((giorno) => (
                  <div key={giorno}>
                    <div className="text-xs font-bold uppercase text-muted-foreground mb-1.5">{giorno}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {slot_per_giorno[giorno].map((s) => {
                        const sel =
                          slot?.giorno === s.giorno &&
                          slot?.ora_inizio === s.ora_inizio &&
                          slot?.ora_fine === s.ora_fine;
                        const senza_istruttori = s.istruttori_liberi === 0;
                        return (
                          <button
                            key={`${s.giorno}-${s.ora_inizio}`}
                            type="button"
                            onClick={() => { set_slot(s); set_istruttore_id(null); }}
                            title={
                              senza_istruttori
                                ? "Nessun istruttore disponibile in questo orario"
                                : `${s.istruttori_liberi} istruttori disponibili`
                            }
                            className={`px-2.5 py-2 rounded-md border text-xs min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
                              sel
                                ? "border-primary ring-2 ring-primary/30 bg-primary/10"
                                : senza_istruttori
                                ? "border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted/50"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <span className="font-semibold">{s.ora_inizio}–{s.ora_fine}</span>
                            <span className="flex items-center gap-1 text-[10px]">
                              <Users className="h-3 w-3" />
                              {s.istruttori_liberi}
                              {s.sovrapposti > 0 && (
                                <>
                                  <Snowflake className="h-3 w-3 ml-1" />
                                  {s.sovrapposti}
                                </>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> istruttori disponibili</span>
                  <span className="flex items-center gap-1"><Snowflake className="h-3 w-3" /> corsi già in pista</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && corso && slot && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{corso.nome}</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {slot.giorno} {slot.ora_inizio}–{slot.ora_fine}
              </span>
            </div>

            {disponibili.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1.5">Disponibili</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {disponibili.map((s) => (
                    <IstruttoreCard
                      key={s.istruttore.id}
                      istruttore={s.istruttore}
                      selected={istruttore_id === s.istruttore.id}
                      on_select={() => set_istruttore_id(s.istruttore.id as string)}
                    />
                  ))}
                </div>
              </div>
            )}

            {non_disponibili.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1.5">
                  Fuori disponibilità (selezionabili comunque)
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {non_disponibili.map((s) => (
                    <IstruttoreCard
                      key={s.istruttore.id}
                      istruttore={s.istruttore}
                      selected={istruttore_id === s.istruttore.id}
                      motivo={
                        s.conflitto_corso_id ? "Già impegnato in un altro corso" : s.motivo_ko || "Fuori disponibilità"
                      }
                      on_select={() => set_istruttore_id(s.istruttore.id as string)}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => set_istruttore_id(null)}
              className={`w-full rounded-md border p-2.5 text-sm min-h-[44px] ${
                istruttore_id === null ? "border-primary bg-primary/10 text-primary" : "border-dashed border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Decido più tardi (nessun istruttore)
            </button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => set_step((s) => s - 1)} disabled={saving}>
              Indietro
            </Button>
          )}
          {step < 3 && (
            <Button
              onClick={() => set_step((s) => s + 1)}
              disabled={(step === 1 && !corso) || (step === 2 && !slot)}
            >
              Avanti
            </Button>
          )}
          {step === 3 && (
            <Button onClick={conferma} disabled={!!saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Posiziona corso
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IstruttoreCard({
  istruttore, selected, motivo, on_select,
}: { istruttore: any; selected: boolean; motivo?: string; on_select: () => void }) {
  return (
    <button
      type="button"
      onClick={on_select}
      className={`text-left rounded-lg border p-3 min-h-[56px] transition-colors ${
        selected
          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
          : motivo
          ? "border-dashed border-amber-400/70 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
          : "border-border hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: istruttore.colore || "#6B7280" }}
        />
        <span className="text-sm font-medium truncate">
          {istruttore.nome} {istruttore.cognome}
        </span>
        {selected && <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
      </div>
      {motivo && <span className="block text-[11px] text-amber-700 dark:text-amber-400 mt-1">{motivo}</span>}
    </button>
  );
}

function build_planning_slots(posizionati: any[], giorno: string): planning_slot_per_conflitto[] {
  const g = norm_giorno(giorno);
  return (posizionati ?? [])
    .filter((c: any) => !c.annullato && norm_giorno(c.giorno) === g)
    .flatMap((c: any) =>
      ((c.istruttori_ids ?? []) as string[]).map((iid) => ({
        corso_id: c.corso_id || c.id,
        istruttore_id: iid,
        ora_inizio: (c.ora_inizio || "").slice(0, 5),
        ora_fine: (c.ora_fine || "").slice(0, 5),
      })),
    );
}
