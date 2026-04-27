import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { calcola_ore_impegnate_giorno } from "@/lib/availability";
import { useI18n, type Locale } from "@/lib/i18n";

const LOCALE_BCP47: Record<Locale, string> = {
  it: "it-IT",
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
  rm: "rm-CH",
};

// ── Helpers data ─────────────────────────────────────────────
function to_date_key(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function add_days_str(date_str: string, days: number): string {
  const d = new Date(date_str + "T00:00:00");
  d.setDate(d.getDate() + days);
  return to_date_key(d);
}

const GIORNI_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function giorno_italiano(date_str: string): string {
  // Mantenuto in italiano: serve a fare match con la colonna `giorno` del DB (vincolo di dominio)
  return GIORNI_IT[new Date(date_str + "T00:00:00").getDay()];
}

function fmt_label(date_str: string, locale_code: string): string {
  return new Date(date_str + "T00:00:00").toLocaleDateString(locale_code, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function fmt_ore(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

// ── Query: tutto in parallelo per il giorno scelto ────────────
function use_disponibilita_giorno(date_str: string) {
  const club_id = get_current_club_id();
  const giorno = giorno_italiano(date_str);

  return useQuery({
    queryKey: ["istruttori_disponibili_giorno", club_id, date_str],
    enabled: !!club_id,
    queryFn: async () => {
      const [istr_res, disp_res, corsi_res, priv_res] = await Promise.all([
        supabase.from("istruttori").select("id,nome,cognome,colore,attivo").eq("club_id", club_id),
        supabase
          .from("disponibilita_istruttori")
          .select("istruttore_id,giorno,ora_inizio,ora_fine")
          .eq("club_id", club_id)
          .eq("giorno", giorno),
        supabase
          .from("planning_corsi_settimana")
          .select("istruttore_id,data,ora_inizio,ora_fine,annullato")
          .eq("data", date_str)
          .eq("annullato", false),
        supabase
          .from("planning_private_settimana")
          .select("istruttore_id,data,ora_inizio,ora_fine,annullato")
          .eq("data", date_str)
          .eq("annullato", false),
      ]);
      if (istr_res.error) throw istr_res.error;
      if (disp_res.error) throw disp_res.error;
      if (corsi_res.error) throw corsi_res.error;
      if (priv_res.error) throw priv_res.error;
      return {
        istruttori: istr_res.data ?? [],
        disponibilita: disp_res.data ?? [],
        corsi: corsi_res.data ?? [],
        private: priv_res.data ?? [],
      };
    },
  });
}

// ── Widget ──────────────────────────────────────────────────
export const IstruttoriDisponibiliWidget: React.FC = () => {
  const navigate = useNavigate();
  const [date_str, set_date_str] = useState<string>(() => to_date_key(new Date()));
  const { data, isLoading } = use_disponibilita_giorno(date_str);

  const is_today = date_str === to_date_key(new Date());
  const giorno = giorno_italiano(date_str);

  const righe = useMemo(() => {
    if (!data) return [] as Array<{
      id: string;
      nome: string;
      cognome: string;
      colore: string | null;
      range_label: string;
      minuti_totali: number;
      minuti_impegnati: number;
      ratio: number;
    }>;
    const istruttori_attivi = data.istruttori.filter((i: any) => i.attivo !== false);
    const out = istruttori_attivi
      .map((i: any) => {
        const fasce = data.disponibilita
          .filter((d: any) => d.istruttore_id === i.id)
          .map((d: any) => ({ ora_inizio: d.ora_inizio, ora_fine: d.ora_fine }));
        if (fasce.length === 0) return null;

        const slot_impegnati = [
          ...data.corsi.filter((c: any) => c.istruttore_id === i.id),
          ...data.private.filter((p: any) => p.istruttore_id === i.id),
        ].map((s: any) => ({ ora_inizio: s.ora_inizio, ora_fine: s.ora_fine }));

        const calc = calcola_ore_impegnate_giorno({
          fasce_disponibilita: fasce,
          slot_impegnati,
        });
        const ratio = calc.minuti_totali > 0 ? calc.minuti_impegnati / calc.minuti_totali : 0;
        return {
          id: i.id,
          nome: i.nome,
          cognome: i.cognome,
          colore: i.colore,
          range_label: calc.range_label,
          minuti_totali: calc.minuti_totali,
          minuti_impegnati: calc.minuti_impegnati,
          ratio,
        };
      })
      .filter(Boolean) as any[];

    // Ordinamento: ore libere residue decrescenti (chi è più libero in cima)
    out.sort((a, b) => {
      const liberi_a = a.minuti_totali - a.minuti_impegnati;
      const liberi_b = b.minuti_totali - b.minuti_impegnati;
      if (liberi_b !== liberi_a) return liberi_b - liberi_a;
      return `${a.cognome}${a.nome}`.localeCompare(`${b.cognome}${b.nome}`);
    });
    return out;
  }, [data]);

  const handle_click_istruttore = (istruttore_id: string) => {
    navigate(`/lezioni-private?istruttore=${istruttore_id}&data=${date_str}`);
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Istruttori disponibili
        </h3>
      </div>

      {/* Header navigazione data */}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => set_date_str((d) => add_days_str(d, -1))}
          aria-label="Giorno precedente"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <button
          onClick={() => set_date_str(to_date_key(new Date()))}
          className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors capitalize ${
            is_today
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {fmt_label(date_str)}
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => set_date_str((d) => add_days_str(d, 1))}
          aria-label="Giorno successivo"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Caricamento…</p>
      ) : righe.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nessun istruttore ha disponibilità il {giorno.toLowerCase()}
        </p>
      ) : (
        <div className="space-y-1.5">
          {righe.map((r) => {
            const completo = r.ratio >= 1;
            const colore = r.colore || "#94a3b8";
            return (
              <button
                key={r.id}
                onClick={() => handle_click_istruttore(r.id)}
                className="w-full text-left rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/30 transition-colors px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colore }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.nome} {r.cognome}
                      </p>
                      {completo ? (
                        <Badge className="h-5 text-[10px] px-1.5 bg-success/15 text-success hover:bg-success/15 border-0">
                          Completo
                        </Badge>
                      ) : (
                        <span className="text-[11px] tabular-nums text-muted-foreground flex-shrink-0">
                          {fmt_ore(r.minuti_impegnati)} / {fmt_ore(r.minuti_totali)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{r.range_label}</p>
                    {/* progress bar */}
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(r.ratio * 100))}%`,
                          backgroundColor: colore,
                          opacity: r.ratio === 0 ? 0.15 : 0.85,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IstruttoriDisponibiliWidget;
