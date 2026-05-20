import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Regola = {
  id: string;
  codice: string;
  attiva: boolean;
  parametri: Record<string, unknown>;
  destinatario_notifica: string;
};

const REGOLE_META: Record<string, { titolo: string; descrizione: string; param_key?: string; param_label?: string; param_default?: number; param_suffix?: string }> = {
  assenze_ripetute: {
    titolo: "⚠️ Assenze ripetute atleta",
    descrizione: "Quando un atleta accumula N assenze consecutive, viene marcato 'a rischio' e generata una notifica allo staff.",
    param_key: "soglia_consecutive",
    param_label: "Soglia assenze consecutive",
    param_default: 3,
    param_suffix: "assenze",
  },
  rifiuto_staff: {
    titolo: "🔄 Rifiuto turno staff",
    descrizione: "Quando un membro dello staff rifiuta un turno, genera notifica urgente con i 3 sostituti suggeriti (ordinati per chi ha lavorato meno).",
  },
  saturazione_bassa: {
    titolo: "📉 Saturazione corso bassa",
    descrizione: "Controllo settimanale (lunedì): se un corso ha saturazione (presenti / iscritti attivi) sotto soglia, notifica lo staff.",
    param_key: "soglia_percentuale",
    param_label: "Soglia saturazione",
    param_default: 50,
    param_suffix: "%",
  },
};

const CODICI_ORDINE = ["assenze_ripetute", "rifiuto_staff", "saturazione_bassa"];

export function RegoleComunicazioniSection({ club_id }: { club_id: string | null }) {
  const [regole, set_regole] = useState<Regola[]>([]);
  const [loading, set_loading] = useState(true);
  const [saving_id, set_saving_id] = useState<string | null>(null);

  useEffect(() => {
    if (!club_id) return;
    (async () => {
      set_loading(true);
      const { data, error } = await supabase
        .from("regole_comunicazioni_club" as never)
        .select("*")
        .eq("club_id", club_id);
      if (error) {
        toast.error("Errore caricamento regole");
      } else {
        const lista = ((data as unknown) as Regola[]) ?? [];
        // crea regole mancanti localmente con default
        const presenti = new Set(lista.map((r) => r.codice));
        const con_default: Regola[] = [...lista];
        for (const codice of CODICI_ORDINE) {
          if (!presenti.has(codice)) {
            con_default.push({
              id: `tmp-${codice}`,
              codice,
              attiva: true,
              parametri: REGOLE_META[codice].param_key
                ? { [REGOLE_META[codice].param_key as string]: REGOLE_META[codice].param_default }
                : {},
              destinatario_notifica: "admin",
            });
          }
        }
        set_regole(con_default.sort((a, b) => CODICI_ORDINE.indexOf(a.codice) - CODICI_ORDINE.indexOf(b.codice)));
      }
      set_loading(false);
    })();
  }, [club_id]);

  const update_regola = async (regola: Regola, patch: Partial<Regola>) => {
    if (!club_id) return;
    set_saving_id(regola.id);
    const nuova = { ...regola, ...patch };
    set_regole((prev) => prev.map((r) => (r.id === regola.id ? nuova : r)));
    const payload = {
      club_id,
      codice: nuova.codice,
      attiva: nuova.attiva,
      parametri: nuova.parametri,
      destinatario_notifica: nuova.destinatario_notifica,
    };
    const { error } = await supabase
      .from("regole_comunicazioni_club" as never)
      .upsert(payload as never, { onConflict: "club_id,codice" });
    set_saving_id(null);
    if (error) {
      toast.error("Errore salvataggio regola");
    } else {
      toast.success("Regola aggiornata");
    }
  };

  if (!club_id) return null;
  if (loading) return <p className="text-xs text-muted-foreground">Caricamento regole…</p>;

  return (
    <div className="space-y-4">
      {regole.map((r) => {
        const meta = REGOLE_META[r.codice];
        if (!meta) return null;
        const param_val = meta.param_key ? (r.parametri?.[meta.param_key] as number | undefined) ?? meta.param_default : undefined;
        return (
          <div key={r.id} className="rounded-md border p-3 space-y-2 bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h4 className="text-sm font-semibold">{meta.titolo}</h4>
                <p className="text-xs text-muted-foreground mt-1">{meta.descrizione}</p>
              </div>
              <Switch
                checked={r.attiva}
                disabled={saving_id === r.id}
                onCheckedChange={(v) => update_regola(r, { attiva: v })}
              />
            </div>

            {meta.param_key && (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs text-muted-foreground">{meta.param_label}:</label>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-24"
                  value={String(param_val ?? meta.param_default)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n < 1) return;
                    set_regole((prev) =>
                      prev.map((x) =>
                        x.id === r.id
                          ? { ...x, parametri: { ...x.parametri, [meta.param_key as string]: n } }
                          : x,
                      ),
                    );
                  }}
                />
                <span className="text-xs text-muted-foreground">{meta.param_suffix}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-8"
                  disabled={saving_id === r.id}
                  onClick={() => update_regola(r, { parametri: r.parametri })}
                >
                  Salva soglia
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs text-muted-foreground">Destinatario notifica:</label>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={r.destinatario_notifica}
                disabled={saving_id === r.id}
                onChange={(e) => update_regola(r, { destinatario_notifica: e.target.value })}
              >
                <option value="admin">Admin (DT)</option>
                <option value="staff">Staff</option>
                <option value="entrambi">Entrambi</option>
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
