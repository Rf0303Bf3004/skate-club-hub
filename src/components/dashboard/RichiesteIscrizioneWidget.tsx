import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, Check, X, UserPlus, CalendarClock, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format_data_completa, format_data_lunga } from "@/lib/format-data";

const REFETCH_MS = 60_000;

function tempo_relativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s fa`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} g fa`;
  return format_data_completa(iso);
}

// ─── Card 1: Richieste pendenti ──────────────────────────────
export const RichiesteIscrizioneWidget: React.FC = () => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const [rifiuto_id, set_rifiuto_id] = useState<string | null>(null);
  const [motivo, set_motivo] = useState("");

  const { data: richieste, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["richieste_pendenti", club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("richieste_iscrizione")
        .select("id, created_at, note_richiesta, atleta_id, corso_id")
        .eq("club_id", club_id)
        .eq("stato", "in_attesa")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];

      const atl_ids = [...new Set(rows.map((r) => r.atleta_id))];
      const cor_ids = [...new Set(rows.map((r) => r.corso_id))];
      const [{ data: atleti }, { data: corsi }] = await Promise.all([
        supabase.from("atleti").select("id, nome, cognome, foto_url").in("id", atl_ids),
        supabase.from("corsi").select("id, nome").in("id", cor_ids),
      ]);
      const a_map = new Map((atleti ?? []).map((a: any) => [a.id, a]));
      const c_map = new Map((corsi ?? []).map((c: any) => [c.id, c]));
      return rows.map((r) => ({
        ...r,
        atleta: a_map.get(r.atleta_id),
        corso: c_map.get(r.corso_id),
      }));
    },
    refetchInterval: REFETCH_MS,
  });

  const approva = useMutation({
    mutationFn: async (r: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData?.user?.id ?? null;
      const { error: e1 } = await supabase
        .from("richieste_iscrizione")
        .update({
          stato: "approvata",
          gestita_da: user_id,
          gestita_il: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("iscrizioni_corsi")
        .insert({ atleta_id: r.atleta_id, corso_id: r.corso_id, attiva: true });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast({ title: "Richiesta approvata" });
      qc.invalidateQueries({ queryKey: ["richieste_pendenti"] });
      qc.invalidateQueries({ queryKey: ["ultime_iscrizioni"] });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const rifiuta = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData?.user?.id ?? null;
      const { error } = await supabase
        .from("richieste_iscrizione")
        .update({
          stato: "rifiutata",
          note_risposta: note,
          gestita_da: user_id,
          gestita_il: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Richiesta rifiutata" });
      set_rifiuto_id(null);
      set_motivo("");
      qc.invalidateQueries({ queryKey: ["richieste_pendenti"] });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const count = richieste?.length ?? 0;

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Inbox className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Richieste pendenti
        </h3>
        {count > 0 && (
          <Badge variant="default">
            {count}
          </Badge>
        )}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Aggiorna"
          title="Aggiorna"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : count === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nessuna richiesta in attesa</p>
      ) : (
        <div className="space-y-3">
          {richieste!.map((r: any) => (
            <div key={r.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {r.atleta?.foto_url ? (
                  <img
                    src={r.atleta.foto_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.atleta?.nome} {r.atleta?.cognome}
                    <span className="text-muted-foreground font-normal"> → {r.corso?.nome ?? "—"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{tempo_relativo(r.created_at)}</p>
                </div>
              </div>
              {r.note_richiesta && (
                <p className="text-xs text-muted-foreground italic pl-10">"{r.note_richiesta}"</p>
              )}

              {rifiuto_id === r.id ? (
                <div className="space-y-2 pl-10">
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => set_motivo(e.target.value)}
                    placeholder="Motivo del rifiuto"
                    className="w-full text-xs border border-border rounded px-2 py-1 bg-background"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={rifiuta.isPending}
                      onClick={() => rifiuta.mutate({ id: r.id, note: motivo })}
                    >
                      Conferma rifiuto
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        set_rifiuto_id(null);
                        set_motivo("");
                      }}
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pl-10">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2"
                    disabled={approva.isPending}
                    onClick={() => approva.mutate(r)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Approva
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2"
                    onClick={() => set_rifiuto_id(r.id)}
                  >
                    <X className="w-3 h-3 mr-1" /> Rifiuta
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Card 2: Ultime iscrizioni dirette ───────────────────────
export const UltimeIscrizioniWidget: React.FC = () => {
  const club_id = get_current_club_id();

  const { data: iscrizioni, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ultime_iscrizioni", club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iscrizioni_corsi")
        .select("id, created_at, atleta_id, corso_id")
        .eq("attiva", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];

      const atl_ids = [...new Set(rows.map((r) => r.atleta_id))];
      const cor_ids = [...new Set(rows.map((r) => r.corso_id))];
      const [{ data: atleti }, { data: corsi }] = await Promise.all([
        supabase.from("atleti").select("id, nome, cognome, club_id").in("id", atl_ids),
        supabase.from("corsi").select("id, nome").in("id", cor_ids),
      ]);
      const a_map = new Map((atleti ?? []).map((a: any) => [a.id, a]));
      const c_map = new Map((corsi ?? []).map((c: any) => [c.id, c]));
      return rows
        .map((r) => ({ ...r, atleta: a_map.get(r.atleta_id), corso: c_map.get(r.corso_id) }))
        .filter((r: any) => r.atleta?.club_id === club_id)
        .slice(0, 10);
    },
    refetchInterval: REFETCH_MS,
  });

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Ultime iscrizioni
        </h3>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Aggiorna"
          title="Aggiorna"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !iscrizioni || iscrizioni.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nessuna iscrizione recente</p>
      ) : (
        <div className="space-y-2">
          {iscrizioni.map((i: any) => (
            <div key={i.id} className="text-sm">
              <p className="text-foreground">
                <span className="font-medium">
                  {i.atleta?.nome} {i.atleta?.cognome}
                </span>{" "}
                <span className="text-muted-foreground">si è iscritto a</span>{" "}
                <span className="font-medium">{i.corso?.nome ?? "—"}</span>
              </p>
              <p className="text-xs text-muted-foreground">{tempo_relativo(i.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Card 3: Richieste lezioni private ───────────────────────
function fmt_ora(t?: string | null): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

export const RichiesteLezioniPrivateWidget: React.FC = () => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const [rifiuto_id, set_rifiuto_id] = useState<string | null>(null);
  const [motivo, set_motivo] = useState("");

  const { data: lezioni, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["richieste_lezioni_private", club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lezioni_private")
        .select("id, data, ora_inizio, ora_fine, ricorrente, note, istruttore_id, created_at")
        .eq("club_id", club_id)
        .eq("richiede_approvazione", true)
        .eq("annullata", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];

      const lez_ids = rows.map((r) => r.id);
      const ist_ids = [...new Set(rows.map((r) => r.istruttore_id).filter(Boolean))];

      const [{ data: lpa }, { data: istruttori }] = await Promise.all([
        supabase
          .from("lezioni_private_atlete")
          .select("lezione_id, atleta_id")
          .in("lezione_id", lez_ids),
        ist_ids.length
          ? supabase.from("istruttori").select("id, nome, cognome, colore").in("id", ist_ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const atl_ids = [...new Set((lpa ?? []).map((x: any) => x.atleta_id))];
      const { data: atleti } = atl_ids.length
        ? await supabase
            .from("atleti")
            .select("id, nome, cognome, foto_url")
            .in("id", atl_ids)
        : { data: [] as any[] };

      const a_map = new Map((atleti ?? []).map((a: any) => [a.id, a]));
      const i_map = new Map((istruttori ?? []).map((i: any) => [i.id, i]));
      const atleti_per_lezione = new Map<string, any[]>();
      (lpa ?? []).forEach((x: any) => {
        const arr = atleti_per_lezione.get(x.lezione_id) ?? [];
        const a = a_map.get(x.atleta_id);
        if (a) arr.push(a);
        atleti_per_lezione.set(x.lezione_id, arr);
      });

      return rows.map((r) => ({
        ...r,
        istruttore: r.istruttore_id ? i_map.get(r.istruttore_id) : null,
        atleti: atleti_per_lezione.get(r.id) ?? [],
      }));
    },
    refetchInterval: REFETCH_MS,
  });

  const approva = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lezioni_private")
        .update({ richiede_approvazione: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lezione approvata" });
      qc.invalidateQueries({ queryKey: ["richieste_lezioni_private"] });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const rifiuta = useMutation({
    mutationFn: async ({ id, note_attuale, motivo }: { id: string; note_attuale: string | null; motivo: string }) => {
      const nuove_note = `${note_attuale ?? ""}${note_attuale ? " | " : ""}RIFIUTATA: ${motivo}`.trim();
      const { error } = await supabase
        .from("lezioni_private")
        .update({ annullata: true, richiede_approvazione: false, note: nuove_note })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lezione rifiutata" });
      set_rifiuto_id(null);
      set_motivo("");
      qc.invalidateQueries({ queryKey: ["richieste_lezioni_private"] });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const count = lezioni?.length ?? 0;

  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Richieste lezioni private
        </h3>
        {count > 0 && (
          <Badge variant="default">
            {count}
          </Badge>
        )}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Aggiorna"
          title="Aggiorna"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : count === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nessuna richiesta in attesa</p>
      ) : (
        <div className="space-y-3">
          {lezioni!.map((l: any) => {
            const a0 = l.atleti?.[0];
            const altri = (l.atleti?.length ?? 0) - 1;
            return (
              <div key={l.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {a0?.foto_url ? (
                    <img src={a0.foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {a0 ? `${a0.nome?.[0] ?? ""}${a0.cognome?.[0] ?? ""}` : "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {a0 ? `${a0.nome} ${a0.cognome}` : "—"}
                      {altri > 0 && (
                        <span className="text-muted-foreground font-normal"> +{altri}</span>
                      )}
                      <span className="text-muted-foreground font-normal">
                        {" → "}
                        {l.istruttore ? `${l.istruttore.nome} ${l.istruttore.cognome}` : "—"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format_data_lunga(l.data, { weekday: "short", day: "numeric", month: "short" })}
                      {" · "}
                      {fmt_ora(l.ora_inizio)}–{fmt_ora(l.ora_fine)}
                      {l.ricorrente && (
                        <span className="ml-1 italic">(ricorrente)</span>
                      )}
                    </p>
                  </div>
                </div>
                {l.note && (
                  <p className="text-xs text-muted-foreground italic pl-10">"{l.note}"</p>
                )}

                {rifiuto_id === l.id ? (
                  <div className="space-y-2 pl-10">
                    <Textarea
                      value={motivo}
                      onChange={(e) => set_motivo(e.target.value)}
                      placeholder="Motivo del rifiuto"
                      className="w-full min-h-[60px] text-xs border border-border rounded px-2 py-1 bg-background resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={rifiuta.isPending}
                        onClick={() =>
                          rifiuta.mutate({ id: l.id, note_attuale: l.note, motivo })
                        }
                      >
                        Conferma rifiuto
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          set_rifiuto_id(null);
                          set_motivo("");
                        }}
                      >
                        Annulla
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pl-10">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2"
                      disabled={approva.isPending}
                      onClick={() => approva.mutate(l.id)}
                    >
                      <Check className="w-3 h-3 mr-1" /> Approva
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2"
                      onClick={() => set_rifiuto_id(l.id)}
                    >
                      <X className="w-3 h-3 mr-1" /> Rifiuta
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
