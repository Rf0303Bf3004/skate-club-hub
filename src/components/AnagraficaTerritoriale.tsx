import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PAESI,
  CANTONI_CH,
  REGIONI_IT,
  getProvinceByRegione,
  getCAPPlaceholder,
  type paese_iso,
} from "@/lib/territori";

export type ValoriTerritoriali = {
  paese_iso?: string | null;
  cantone?: string | null;
  regione?: string | null;
  provincia?: string | null;
  cap?: string | null;
  citta?: string | null;
  indirizzo?: string | null;
};

type Props = {
  values: ValoriTerritoriali;
  onChange: (patch: Partial<ValoriTerritoriali>) => void;
  /** Prefisso per gli id input (es. "genitore1_"). Opzionale. */
  id_prefix?: string;
  /** Se true, nasconde il selettore Paese (utile se l'eredita dal genitore). */
  hide_paese?: boolean;
  /** Layout 1/2 colonne. */
  cols?: 1 | 2;
  /** Mostra indirizzo + città oltre a territorio + CAP. */
  show_indirizzo?: boolean;
};

/**
 * Sezione anagrafica territoriale adattiva a CH / IT.
 */
export function AnagraficaTerritoriale({
  values,
  onChange,
  id_prefix = "",
  hide_paese = false,
  cols = 2,
  show_indirizzo = true,
}: Props) {
  const paese: paese_iso = (values.paese_iso as paese_iso) || "CH";
  const grid_cls = cols === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3";

  return (
    <div className="space-y-3">
      {!hide_paese && (
        <div>
          <Label htmlFor={`${id_prefix}paese_iso`}>Paese</Label>
          <select
            id={`${id_prefix}paese_iso`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={paese}
            onChange={(e) =>
              onChange({
                paese_iso: e.target.value,
                // azzera campi specifici del paese precedente
                cantone: null,
                regione: null,
                provincia: null,
              })
            }
          >
            {PAESI.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {show_indirizzo && (
        <div className={grid_cls}>
          <div className="sm:col-span-2">
            <Label htmlFor={`${id_prefix}indirizzo`}>Indirizzo</Label>
            <Input
              id={`${id_prefix}indirizzo`}
              value={values.indirizzo ?? ""}
              onChange={(e) => onChange({ indirizzo: e.target.value })}
              placeholder="Via e numero"
            />
          </div>
          <div>
            <Label htmlFor={`${id_prefix}citta`}>Città</Label>
            <Input
              id={`${id_prefix}citta`}
              value={values.citta ?? ""}
              onChange={(e) => onChange({ citta: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${id_prefix}cap`}>CAP</Label>
            <Input
              id={`${id_prefix}cap`}
              value={values.cap ?? ""}
              onChange={(e) => onChange({ cap: e.target.value })}
              placeholder={getCAPPlaceholder(paese)}
              inputMode="numeric"
              maxLength={paese === "CH" ? 4 : 5}
            />
          </div>
        </div>
      )}

      {paese === "CH" ? (
        <div>
          <Label htmlFor={`${id_prefix}cantone`}>Cantone</Label>
          <select
            id={`${id_prefix}cantone`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={values.cantone ?? ""}
            onChange={(e) => onChange({ cantone: e.target.value || null })}
          >
            <option value="">— Seleziona —</option>
            {CANTONI_CH.map((c) => (
              <option key={c.sigla} value={c.sigla}>
                {c.sigla} — {c.nome}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className={grid_cls}>
          <div>
            <Label htmlFor={`${id_prefix}regione`}>Regione</Label>
            <select
              id={`${id_prefix}regione`}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={values.regione ?? ""}
              onChange={(e) =>
                onChange({ regione: e.target.value || null, provincia: null })
              }
            >
              <option value="">— Seleziona —</option>
              {REGIONI_IT.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id_prefix}provincia`}>Provincia</Label>
            <select
              id={`${id_prefix}provincia`}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={values.provincia ?? ""}
              onChange={(e) => onChange({ provincia: e.target.value || null })}
              disabled={!values.regione}
            >
              <option value="">
                {values.regione ? "— Seleziona —" : "Scegli prima la regione"}
              </option>
              {(values.regione ? getProvinceByRegione(values.regione) : []).map((p) => (
                <option key={p.sigla} value={p.sigla}>
                  {p.sigla} — {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
