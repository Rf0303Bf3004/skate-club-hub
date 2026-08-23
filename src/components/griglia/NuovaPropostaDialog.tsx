import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { format_local_iso } from "@/lib/planning-occorrenze";
import { use_livelli } from "@/hooks/use-supabase-data";
import { use_proposte, type Proposta } from "@/hooks/use-proposte";
import { Package, CalendarRange, CalendarDays } from "lucide-react";

const SENZA_LIVELLO = "__nessuno__";

export interface ConfermaProposta {
  /** null = nuova proposta (usa nome/prezzo/livello), altrimenti proposta esistente. */
  proposta_esistente: Proposta | null;
  nome: string;
  prezzo_mensile: number | null;
  livello_id: string | null;
  /** null = solo oggi (nessuna ricorrenza) */
  fino_a: string | null;
}

interface Props {
  open: boolean;
  on_close: () => void;
  giorno: string;
  data_blocco: string;
  in_corso?: boolean;
  on_conferma: (dati: ConfermaProposta) => void;
}

/** Ultima occorrenza dello stesso giorno-settimana entro `limite`. */
function ultima_occorrenza(data_blocco: string, limite: string): string {
  const cursore = new Date(`${data_blocco}T00:00:00`);
  const fine = new Date(`${limite}T00:00:00`);
  let ultima = new Date(cursore);
  while (cursore <= fine) {
    ultima = new Date(cursore);
    cursore.setDate(cursore.getDate() + 7);
  }
  return format_local_iso(ultima);
}

const NuovaPropostaDialog: React.FC<Props> = ({
  open,
  on_close,
  giorno,
  data_blocco,
  in_corso,
  on_conferma,
}) => {
  const { data: livelli = [] } = use_livelli();
  const { data: proposte = [] } = use_proposte(true);

  const [modo, set_modo] = useState<"nuova" | "esistente">("nuova");
  const [nome, set_nome] = useState("");
  const [prezzo, set_prezzo] = useState("");
  const [livello_id, set_livello_id] = useState<string>(SENZA_LIVELLO);
  const [proposta_id, set_proposta_id] = useState<string>("");
  const [n_settimane, set_n_settimane] = useState(8);
  const [fine_stagione, set_fine_stagione] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    set_modo("nuova");
    set_nome("");
    set_prezzo("");
    set_livello_id(SENZA_LIVELLO);
    set_proposta_id("");
    const club_id = get_current_club_id();
    if (!club_id) return;
    (async () => {
      const { data } = await supabase
        .from("stagioni")
        .select("data_fine,attiva,data_inizio")
        .eq("club_id", club_id)
        .order("data_inizio", { ascending: false });
      const lista = (data ?? []) as any[];
      const st = lista.find((s) => s.attiva) ?? lista[0] ?? null;
      set_fine_stagione(st?.data_fine ?? null);
    })();
  }, [open]);

  const data_fine_n = useMemo(() => {
    const d = new Date(`${data_blocco}T00:00:00`);
    d.setDate(d.getDate() + 7 * Math.max(1, Math.min(52, n_settimane)));
    return format_local_iso(d);
  }, [data_blocco, n_settimane]);

  const scelta = proposte.find((p) => p.id === proposta_id) ?? null;

  const valido =
    modo === "nuova" ? nome.trim().length > 0 : !!scelta;

  const dati_base = (): Omit<ConfermaProposta, "fino_a"> =>
    modo === "esistente" && scelta
      ? {
          proposta_esistente: scelta,
          nome: scelta.nome,
          prezzo_mensile: scelta.prezzo_mensile ?? null,
          livello_id: scelta.livello_id ?? null,
        }
      : {
          proposta_esistente: null,
          nome: nome.trim(),
          prezzo_mensile: prezzo.trim() === "" ? null : Number(prezzo),
          livello_id: livello_id === SENZA_LIVELLO ? null : livello_id,
        };

  const conferma = (fino_a: string | null) => {
    if (!valido) return;
    on_conferma({ ...dati_base(), fino_a });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && on_close()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Crea proposta da questa sessione
          </DialogTitle>
          <DialogDescription>
            La proposta raggruppa più occorrenze settimanali sotto lo stesso nome e prezzo. La pista è quella
            del blocco corrente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={modo === "nuova" ? "default" : "outline"}
              onClick={() => set_modo("nuova")}
            >
              Nuova proposta
            </Button>
            <Button
              type="button"
              variant={modo === "esistente" ? "default" : "outline"}
              onClick={() => set_modo("esistente")}
            >
              Proposta esistente
            </Button>
          </div>

          {modo === "nuova" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm">Nome proposta</Label>
                <Input
                  value={nome}
                  onChange={(e) => set_nome(e.target.value)}
                  placeholder="Es. Corso Artistico Avanzato"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Prezzo mensile (CHF)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.05"
                  value={prezzo}
                  onChange={(e) => set_prezzo(e.target.value)}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Livello (opzionale)</Label>
                <Select value={livello_id} onValueChange={set_livello_id}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Nessun livello specifico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SENZA_LIVELLO}>Nessun livello specifico</SelectItem>
                    {(livelli as any[]).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-sm">Proposta esistente</Label>
              <Select value={proposta_id} onValueChange={set_proposta_id}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Scegli una proposta attiva…" />
                </SelectTrigger>
                <SelectContent>
                  {proposte.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                      {p.prezzo_mensile != null ? ` · CHF ${p.prezzo_mensile}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {proposte.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nessuna proposta attiva: creane una nuova.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 pt-1 border-t">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              disabled={in_corso || !valido}
              onClick={() => conferma(null)}
            >
              <CalendarDays className="w-4 h-4 mr-3 shrink-0" />
              <span className="text-left">
                <span className="block font-medium">Solo oggi</span>
                <span className="block text-xs text-muted-foreground">
                  Nessuna ricorrenza, resta una sessione singola
                </span>
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              disabled={in_corso || !valido || !fine_stagione}
              onClick={() => fine_stagione && conferma(ultima_occorrenza(data_blocco, fine_stagione))}
            >
              <CalendarRange className="w-4 h-4 mr-3 shrink-0" />
              <span className="text-left">
                <span className="block font-medium">Ogni {giorno} fino a fine stagione</span>
                <span className="block text-xs text-muted-foreground">
                  {fine_stagione
                    ? `Ultima occorrenza entro il ${new Date(`${fine_stagione}T00:00:00`).toLocaleDateString("it-CH")}`
                    : "Nessuna stagione attiva configurata"}
                </span>
              </span>
            </Button>

            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-sm font-medium">Ogni {giorno} per N settimane</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={n_settimane}
                  onChange={(e) => set_n_settimane(Number(e.target.value) || 1)}
                  className="h-9 w-24"
                />
                <Button className="flex-1" disabled={in_corso || !valido} onClick={() => conferma(data_fine_n)}>
                  {in_corso ? "Creazione…" : "Crea proposta e ricorrenza"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ultima occorrenza: {new Date(`${data_fine_n}T00:00:00`).toLocaleDateString("it-CH")}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NuovaPropostaDialog;
