import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { usePermessiSezioniMatrix } from "@/hooks/usePermessi";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { can_manage_griglia } from "@/lib/roles";
import {
  use_griglia_blocchi_giorno,
  use_upsert_blocco,
  use_elimina_blocco,
  type GrigliaBlocco,
} from "@/hooks/use-griglia-ghiaccio";
import GrigliaBuilder from "@/components/griglia/GrigliaBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { LayoutGrid, Plus, Trash2, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";

function oggi_iso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function label_data(data_iso: string): string {
  if (!data_iso) return "";
  const d = new Date(`${data_iso}T00:00:00`);
  return d.toLocaleDateString("it-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function hhmm(t?: string | null): string {
  return (t ?? "").slice(0, 5);
}

const GrigliaGhiaccioPage: React.FC = () => {
  const { session } = useAuth();
  const { visibile_set, is_admin_like, is_loading: is_loading_permessi } = usePermessiSezioniMatrix();
  const allowed = is_admin_like || visibile_set.has("griglia_ghiaccio");
  const { modalita, is_loading: is_loading_modalita } = useModalitaArea("ghiaccio");
  const is_editor = can_manage_griglia(session?.ruolo);

  const [data_sel, set_data_sel] = useState<string>(oggi_iso());
  const [espansi, set_espansi] = useState<string[]>([]);
  const [modal_open, set_modal_open] = useState(false);
  const [form, set_form] = useState({ ora_inizio: "17:00", ora_fine: "18:00", titolo: "" });

  const { data: blocchi = [], isLoading } = use_griglia_blocchi_giorno(data_sel);
  const upsert_blocco = use_upsert_blocco();
  const elimina_blocco = use_elimina_blocco();

  const titolo_suggerito = useMemo(() => {
    const l = label_data(data_sel);
    return l ? `Griglia di ${l.charAt(0).toUpperCase()}${l.slice(1)}` : "Griglia";
  }, [data_sel]);

  const toggle_espanso = (id: string) =>
    set_espansi((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const salva_blocco = async () => {
    try {
      const id = await upsert_blocco.mutateAsync({
        data: data_sel,
        ora_inizio: form.ora_inizio,
        ora_fine: form.ora_fine,
        titolo: form.titolo.trim() || titolo_suggerito,
      });
      set_modal_open(false);
      set_form({ ora_inizio: "17:00", ora_fine: "18:00", titolo: "" });
      if (id) set_espansi((prev) => [...prev, id]);
      toast({ title: "Blocco creato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const rimuovi_blocco = async (id: string) => {
    try {
      await elimina_blocco.mutateAsync(id);
      toast({ title: "Blocco eliminato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  // ─── Controllo permessi (dopo tutti gli hook) ────────────
  if (is_loading_permessi || is_loading_modalita) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) return <Navigate to="/" replace />;

  if (modalita !== "griglia_giornaliera") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <LayoutGrid className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Griglia Ghiaccio</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Questa funzione non è attiva per il tuo club. Attivala in Setup del Club → Modalità di gestione.
        </p>
      </div>
    );
  }

  const render_lettura = (b: GrigliaBlocco) => (
    <div className="space-y-2">
      {(b.sessioni ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nessuna sotto-sessione.</p>
      )}
      {(b.sessioni ?? []).map((s) => (
        <div key={s.id} className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {hhmm(s.ora_inizio)}–{hhmm(s.ora_fine)}
            </span>
            <Badge variant="secondary">
              {s.specialita_nome || s.specialita_testo_libero || "Specialità non definita"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.istruttori.map((i) => (
              <span
                key={i.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-primary/40 bg-primary/10"
              >
                <GraduationCap className="w-3 h-3 text-primary" />
                {i.nome} {i.cognome}
              </span>
            ))}
            {s.atleti.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-border bg-background"
              >
                {a.nome} {a.cognome}
              </span>
            ))}
            {s.atleti.length === 0 && s.istruttori.length === 0 && (
              <span className="text-xs text-muted-foreground">Nessun assegnato.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" /> Griglia Ghiaccio
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{label_data(data_sel)}</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={data_sel}
              onChange={(e) => set_data_sel(e.target.value)}
              className="h-9 w-[11rem]"
            />
          </div>
          {is_editor && (
            <Button onClick={() => set_modal_open(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nuovo blocco
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : blocchi.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nessun blocco ghiaccio per questa data.
        </div>
      ) : (
        <div className="space-y-3">
          {blocchi.map((b) => {
            const aperto = espansi.includes(b.id);
            return (
              <div key={b.id} className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggle_espanso(b.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                  >
                    {aperto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-semibold truncate">{b.titolo || "Blocco ghiaccio"}</span>
                    <span className="text-sm text-muted-foreground">
                      {hhmm(b.ora_inizio)}–{hhmm(b.ora_fine)}
                    </span>
                  </button>
                  <Badge
                    className={
                      b.stato === "pubblicato"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    }
                  >
                    {b.stato === "pubblicato" ? "Pubblicato" : "Bozza"}
                  </Badge>
                  {is_editor && (
                    <Button variant="ghost" size="icon" onClick={() => rimuovi_blocco(b.id)} title="Elimina blocco">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {aperto && (
                  <div className="px-3 pb-4 border-t pt-3">
                    {is_editor ? <GrigliaBuilder blocco={b} blocchi_giorno={blocchi} /> : render_lettura(b)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modal_open} onOpenChange={set_modal_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo blocco ghiaccio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ora inizio</Label>
                <Input
                  type="time"
                  value={form.ora_inizio}
                  onChange={(e) => set_form((f) => ({ ...f, ora_inizio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ora fine</Label>
                <Input
                  type="time"
                  value={form.ora_fine}
                  onChange={(e) => set_form((f) => ({ ...f, ora_fine: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Titolo (opzionale)</Label>
              <Input
                value={form.titolo}
                onChange={(e) => set_form((f) => ({ ...f, titolo: e.target.value }))}
                placeholder={titolo_suggerito}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_modal_open(false)}>
              Annulla
            </Button>
            <Button onClick={salva_blocco} disabled={upsert_blocco.isPending}>
              Crea blocco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrigliaGhiaccioPage;
