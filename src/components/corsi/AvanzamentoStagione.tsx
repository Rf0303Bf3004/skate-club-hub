import React from "react";
import { CheckCircle2, CalendarClock, UserX, Snowflake } from "lucide-react";

export type StatoCorso = "tutti" | "completi" | "da_pianificare" | "senza_istruttore" | "fuori_ghiaccio";

type Props = {
  conteggi: Record<Exclude<StatoCorso, "tutti">, number>;
  totale: number;
  attivo: StatoCorso;
  on_change: (s: StatoCorso) => void;
};

const CARDS: {
  key: Exclude<StatoCorso, "tutti">;
  label: string;
  icon: React.ElementType;
  tone: string;
  tone_active: string;
}[] = [
  {
    key: "completi",
    label: "Completi",
    icon: CheckCircle2,
    tone: "border-border hover:border-emerald-400/60 text-emerald-700",
    tone_active: "border-emerald-500 bg-emerald-50 text-emerald-800",
  },
  {
    key: "da_pianificare",
    label: "Da pianificare",
    icon: CalendarClock,
    tone: "border-border hover:border-amber-400/60 text-amber-700",
    tone_active: "border-amber-500 bg-amber-50 text-amber-800",
  },
  {
    key: "senza_istruttore",
    label: "Senza istruttore valido",
    icon: UserX,
    tone: "border-border hover:border-orange-400/60 text-orange-700",
    tone_active: "border-orange-500 bg-orange-50 text-orange-800",
  },
  {
    key: "fuori_ghiaccio",
    label: "Fuori fascia ghiaccio",
    icon: Snowflake,
    tone: "border-border hover:border-sky-400/60 text-sky-700",
    tone_active: "border-sky-500 bg-sky-50 text-sky-800",
  },
];

export const AvanzamentoStagione: React.FC<Props> = ({ conteggi, totale, attivo, on_change }) => {
  const pronti = totale > 0 ? Math.round((conteggi.completi / totale) * 100) : 0;

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">
          Avanzamento stagione
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {conteggi.completi} di {totale} corsi pronti
          </span>
        </div>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">{pronti}%</span>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pronti}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {CARDS.map(({ key, label, icon: Icon, tone, tone_active }) => {
          const is_active = attivo === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => on_change(is_active ? "tutti" : key)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors min-h-[52px] ${
                is_active ? tone_active : `bg-background ${tone}`
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-lg font-bold tabular-nums">{conteggi[key]}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
