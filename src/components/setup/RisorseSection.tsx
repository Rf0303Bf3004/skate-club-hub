import React from "react";
import { useAuth } from "@/lib/auth";
import {
  use_risorse_strutture,
  use_upsert_risorsa,
  use_elimina_risorsa,
  use_eventi_campi_opzioni,
  type RisorsaStruttura,
} from "@/hooks/use-risorse-strutture";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, MapPin, Luggage } from "lucide-react";

const empty_form = {
  nome: "",
  tipo: "ghiaccio" as "ghiaccio" | "palestra",
  attiva: true,
  colore: "#3B82F6",
  capienza_max: "",
  is_ospite: false,
  nome_struttura_ospitante: "",
  indirizzo_ospitante: "",
  evento_campo_id: "",
};


const RisorsaDialog: React.FC<{
  open: boolean;
  on_close: () => void;
  risorsa?: RisorsaStruttura | null;
}> = ({ open, on_close, risorsa }) => {
  const upsert = use_upsert_risorsa();
  const { data: eventi_campi = [] } = use_eventi_campi_opzioni();
  const [form, set_form] = React.useState<Record<string, any>>(empty_form);

  React.useEffect(() => {
    if (!open) return;
    set_form(
      risorsa
        ? {
            nome: risorsa.nome ?? "",
            tipo: risorsa.tipo ?? "ghiaccio",
            attiva: risorsa.attiva !== false,
            colore: risorsa.colore || "#3B82F6",
            capienza_max: risorsa.capienza_max == null ? "" : String(risorsa.capienza_max),
            is_ospite: !!risorsa.is_ospite,
            nome_struttura_ospitante: risorsa.nome_struttura_ospitante ?? "",
            indirizzo_ospitante: risorsa.indirizzo_ospitante ?? "",
            evento_campo_id: risorsa.evento_campo_id ?? "",
          }
        : empty_form,
    );
  }, [open, risorsa]);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  const salva = async () => {
    if (!String(form.nome).trim()) {
      toast({ title: "Il nome è obbligatorio", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        ...(risorsa?.id ? { id: risorsa.id } : {}),
        nome: String(form.nome).trim(),
        tipo: form.tipo,
        attiva: !!form.attiva,
        colore: form.colore || null,
        capienza_max: form.capienza_max === "" ? null : Number(form.capienza_max),
        is_ospite: !!form.is_ospite,
        nome_struttura_ospitante: form.is_ospite
          ? String(form.nome_struttura_ospitante).trim() || null
          : null,
        indirizzo_ospitante: form.is_ospite ? String(form.indirizzo_ospitante).trim() || null : null,
        evento_campo_id: form.is_ospite ? form.evento_campo_id || null : null,
      } as any);

      toast({ title: "Risorsa salvata" });
      on_close();
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && on_close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{risorsa ? "Modifica risorsa" : "Nuova risorsa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input
              value={form.nome}
              placeholder="es. Pista Olimpica"
              onChange={(e) => set_val("nome", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.tipo}
                onChange={(e) => set_val("tipo", e.target.value)}
              >
                <option value="ghiaccio">Ghiaccio</option>
                <option value="palestra">Palestra</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Capienza massima</Label>
              <Input
                type="number"
                min={1}
                placeholder="opzionale"
                value={form.capienza_max}
                onChange={(e) => set_val("capienza_max", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Colore</Label>
              <Input
                type="color"
                className="h-10 w-20 p-1"
                value={form.colore}
                onChange={(e) => set_val("colore", e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 pt-5 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={!!form.attiva}
                onChange={(e) => set_val("attiva", e.target.checked)}
              />
              Attiva
            </label>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={!!form.is_ospite}
                onChange={(e) => set_val("is_ospite", e.target.checked)}
              />
              <Luggage className="h-4 w-4 text-muted-foreground" />
              È una risorsa ospite (trasferta)
            </label>

            {form.is_ospite && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome struttura/club ospitante</Label>
                  <Input
                    value={form.nome_struttura_ospitante}
                    placeholder="es. PalaGhiaccio Como"
                    onChange={(e) => set_val("nome_struttura_ospitante", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Indirizzo</Label>
                  <Input
                    value={form.indirizzo_ospitante}
                    placeholder="es. Via Sinigaglia 1, Como"
                    onChange={(e) => set_val("indirizzo_ospitante", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Collega a un Campo/evento specifico (opzionale)
                  </Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={form.evento_campo_id}
                    onChange={(e) => set_val("evento_campo_id", e.target.value)}
                  >
                    <option value="">Nessuno — riutilizzabile in futuro</option>
                    {eventi_campi.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.nome}
                        {ev.data_inizio ? ` (${ev.data_inizio}${ev.data_fine ? ` → ${ev.data_fine}` : ""})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={on_close}>
            Annulla
          </Button>
          <Button onClick={salva} disabled={upsert.isPending}>
            {upsert.isPending ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RisorseSection: React.FC = () => {
  const { session } = useAuth();
  const allowed = !!session && ["superadmin", "admin", "presidente"].includes(session.ruolo);
  const { data: risorse = [], isLoading } = use_risorse_strutture();
  const elimina = use_elimina_risorsa();
  const [dialog_open, set_dialog_open] = React.useState(false);
  const [edit_risorsa, set_edit_risorsa] = React.useState<RisorsaStruttura | null>(null);

  if (!allowed) return null;

  const gruppi: { tipo: "ghiaccio" | "palestra"; label: string }[] = [
    { tipo: "ghiaccio", label: "Piste ghiaccio" },
    { tipo: "palestra", label: "Palestre" },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Risorse e strutture</h2>
        </div>
        <Button
          size="sm"
          onClick={() => {
            set_edit_risorsa(null);
            set_dialog_open(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nuova risorsa
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : risorse.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna risorsa configurata. Aggiungi le piste di ghiaccio e le palestre del club.
        </p>
      ) : (
        <div className="space-y-5">
          {gruppi.map((g) => {
            const lista = risorse.filter((r) => r.tipo === g.tipo);
            if (lista.length === 0) return null;
            return (
              <div key={g.tipo} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{g.label}</p>
                <div className="space-y-2">
                  {lista.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: r.colore || "#3B82F6" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{r.nome}</p>
                          <Badge variant={r.attiva ? "default" : "outline"} className="text-[10px]">
                            {r.attiva ? "Attiva" : "Disattiva"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Capienza {r.capienza_max ?? "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            set_edit_risorsa(r);
                            set_dialog_open(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={async () => {
                            try {
                              await elimina.mutateAsync(r.id);
                              toast({ title: "Risorsa eliminata" });
                            } catch (e: any) {
                              toast({ title: "Errore", description: e?.message, variant: "destructive" });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RisorsaDialog
        open={dialog_open}
        on_close={() => set_dialog_open(false)}
        risorsa={edit_risorsa}
      />
    </section>
  );
};

export default RisorseSection;
