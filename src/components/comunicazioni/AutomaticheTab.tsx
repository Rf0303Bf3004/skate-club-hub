import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Bot } from 'lucide-react';
import { ListaComunicazioni } from '@/components/comunicazioni/ListaComunicazioni';
import {
  raggruppa_comunicazioni,
  riepilogo_automatiche,
} from '@/lib/raggruppa-comunicazioni';

type Props = {
  items: any[];
  get_destinatari_label: (c: any) => string;
  get_data_label: (c: any) => string;
  can_manage?: boolean;
  nome_atleta?: (id: string | null) => string;
  highlight_unread?: boolean;
  on_open?: (c: any) => void;
};

function giorno_di(c: any) {
  const iso = c.created_at || (c.data ? `${c.data}T00:00:00` : null);
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function etichetta_giorno(giorno: string) {
  if (!giorno) return 'Senza data';
  return new Date(`${giorno}T00:00:00`).toLocaleDateString('it-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Comunicazioni generate dal sistema, raccolte per giorno e richiudibili. */
export const AutomaticheTab: React.FC<Props> = ({
  items,
  get_destinatari_label,
  get_data_label,
  can_manage,
  nome_atleta,
  highlight_unread,
  on_open,
}) => {
  const giorni = useMemo(() => {
    const mappa = new Map<string, any[]>();
    items.forEach((c) => {
      const g = giorno_di(c);
      const lista = mappa.get(g);
      if (lista) lista.push(c);
      else mappa.set(g, [c]);
    });
    return Array.from(mappa.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([giorno, righe]) => {
        const gruppi = raggruppa_comunicazioni(righe);
        return {
          giorno,
          righe,
          n_invii: gruppi.length,
          riepilogo: riepilogo_automatiche(gruppi),
        };
      });
  }, [items]);

  const [aperti, set_aperti] = useState<string[]>(() => {
    // I giorni con avvisi non letti restano aperti: non devono passare inosservati.
    const con_non_letti = giorni
      .filter((g) => g.righe.some((r: any) => r.categoria === 'ricevuta' && !r.letta))
      .map((g) => g.giorno);
    if (con_non_letti.length) return con_non_letti;
    return giorni[0] ? [giorni[0].giorno] : [];
  });

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card p-12 text-center space-y-3">
        <div className="flex justify-center text-muted-foreground/40"><Bot className="w-12 h-12" /></div>
        <p className="text-sm text-muted-foreground">Nessun avviso automatico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {giorni.map((g) => {
        const aperto = aperti.includes(g.giorno);
        return (
          <div key={g.giorno} className="bg-card rounded-xl shadow-card overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              onClick={() =>
                set_aperti((prev) =>
                  prev.includes(g.giorno) ? prev.filter((x) => x !== g.giorno) : [...prev, g.giorno],
                )
              }
            >
              {aperto ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <span className="font-semibold text-foreground">{etichetta_giorno(g.giorno)}</span>
              <span className="text-sm text-muted-foreground truncate">— {g.riepilogo}</span>
            </button>
            {aperto && (
              <div className="border-t border-border bg-muted/10 p-3">
                <ListaComunicazioni
                  items={g.righe}
                  mode="attive"
                  compatto
                  highlight_unread={highlight_unread}
                  on_open={on_open}
                  get_destinatari_label={get_destinatari_label}
                  get_data_label={get_data_label}
                  empty_text="Nessun avviso."
                  can_manage={can_manage}
                  nome_atleta={nome_atleta}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AutomaticheTab;
