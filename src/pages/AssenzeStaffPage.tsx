import React from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, UserX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { segnala_errore, messaggio_leggibile } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import EmptyState from "@/components/common/EmptyState";
import { toast } from "@/hooks/use-toast";

import { format_data, format_data_ora } from "@/lib/format-data";
/**
 * Assenze annunciate dallo staff: un posto dove il club le vede tutte e dice
 * come sono finite. Un dato che manca va detto, mai nascosto.
 */

type Esito = "annunciata" | "presentata" | "sostituita" | "ritirata";

type RigaEsito = {
  destinatario_staff_id: string;
  esito: string;
  sostituto_istruttore_id: string | null;
  nota: string | null;
};

type RigaAssenza = {
  dest_id: string;
  user_id: string | null;
  rsvp_risposta: string | null;
  rsvp_at: string | null;
  /** Null quando la sessione di planning non esiste più e non c'è data_evento. */
  data_turno: string | null;
  ora_inizio: string | null;
  nome_corso: string | null;
  sessione_mancante: boolean;
};

const chiave_giorno = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ora_breve = (v: string | null | undefined) => (v ? String(v).slice(0, 5) : null);

const periodo_mese = (iso: string | null) => (iso ? iso.slice(0, 7) : null);

export default function AssenzeStaffPage() {
  const { t } = useTranslation("istruttori");
  const { session } = useAuth();
  const club_id = session?.club_id ?? "";
  const qc = useQueryClient();

  const [filtro_periodo, set_filtro_periodo] = React.useState<"prossimi_7" | "mese" | "tutto">("prossimi_7");
  const [filtro_persona, set_filtro_persona] = React.useState<string>("tutte");
  const [note_locali, set_note_locali] = React.useState<Record<string, string>>({});
  const [sostituzione_per, set_sostituzione_per] = React.useState<RigaAssenza | null>(null);
  const [sostituto_scelto, set_sostituto_scelto] = React.useState<string>("");

  const oggi = React.useMemo(() => chiave_giorno(new Date()), []);

  // 1) Le assenze annunciate, più quelle già gestite anche se nel frattempo ritirate.
  const assenze_query = useQuery({
    queryKey: ["assenze_staff", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const seleziona = "id, user_id, rsvp_risposta, rsvp_at, comunicazioni!inner(sotto_tipo, planning_corso_id, data_evento)";

      const { data: annunciate, error } = await supabase
        .from("comunicazioni_destinatari_staff")
        .select(seleziona)
        .eq("club_id", club_id)
        .eq("rsvp_risposta", "no")
        .eq("comunicazioni.sotto_tipo", "reminder_staff");
      if (error) throw error;

      const { data: esiti_righe, error: err_esiti } = await supabase
        .from("assenze_staff_esiti")
        .select("destinatario_staff_id, esito, sostituto_istruttore_id, nota")
        .eq("club_id", club_id);
      if (err_esiti) throw err_esiti;

      const grezze = [...((annunciate ?? []) as any[])];
      const gia_presenti = new Set(grezze.map((r) => r.id as string));
      const mancanti = ((esiti_righe ?? []) as RigaEsito[])
        .map((e) => e.destinatario_staff_id)
        .filter((id) => !gia_presenti.has(id));

      if (mancanti.length > 0) {
        const { data: ritirate, error: err_rit } = await supabase
          .from("comunicazioni_destinatari_staff")
          .select(seleziona)
          .eq("club_id", club_id)
          .eq("comunicazioni.sotto_tipo", "reminder_staff")
          .in("id", mancanti);
        if (err_rit) throw err_rit;
        grezze.push(...((ritirate ?? []) as any[]));
      }

      const planning_ids = [
        ...new Set(grezze.map((r) => r.comunicazioni?.planning_corso_id).filter(Boolean) as string[]),
      ];
      let sessioni: any[] = [];
      if (planning_ids.length > 0) {
        const { data: plan, error: err_plan } = await supabase
          .from("planning_corsi_settimana")
          .select("id, data, ora_inizio, titolo_override, corsi(nome)")
          .in("id", planning_ids);
        if (err_plan) throw err_plan;
        sessioni = (plan ?? []) as any[];
      }
      const per_sessione = new Map(sessioni.map((s) => [s.id as string, s]));

      const user_ids = [...new Set(grezze.map((r) => r.user_id).filter(Boolean) as string[])];
      let persone: any[] = [];
      if (user_ids.length > 0) {
        const { data: ist, error: err_ist } = await supabase
          .from("istruttori")
          .select("id, nome, cognome, user_id")
          .eq("club_id", club_id)
          .in("user_id", user_ids);
        if (err_ist) throw err_ist;
        persone = (ist ?? []) as any[];
      }
      const per_utente = new Map(persone.map((p) => [p.user_id as string, p]));

      const righe: (RigaAssenza & { nome_persona: string | null })[] = grezze.map((r) => {
        const s = per_sessione.get(r.comunicazioni?.planning_corso_id ?? "");
        const persona = r.user_id ? per_utente.get(r.user_id) : null;
        return {
          dest_id: r.id as string,
          user_id: (r.user_id ?? null) as string | null,
          rsvp_risposta: (r.rsvp_risposta ?? null) as string | null,
          rsvp_at: (r.rsvp_at ?? null) as string | null,
          data_turno: (s?.data ?? r.comunicazioni?.data_evento ?? null) as string | null,
          ora_inizio: ora_breve(s?.ora_inizio),
          nome_corso: (s?.titolo_override ?? s?.corsi?.nome ?? null) as string | null,
          sessione_mancante: !s,
          nome_persona: persona ? `${persona.nome ?? ""} ${persona.cognome ?? ""}`.trim() || null : null,
        };
      });

      const esiti = new Map(((esiti_righe ?? []) as RigaEsito[]).map((e) => [e.destinatario_staff_id, e]));
      return { righe, esiti };
    },
  });

  // 2) Istruttori attivi del club, per scegliere un sostituto.
  const istruttori_query = useQuery({
    queryKey: ["assenze_staff_istruttori", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("istruttori")
        .select("id, nome, cognome")
        .eq("club_id", club_id)
        .eq("attivo", true)
        .order("cognome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string | null; cognome: string | null }[];
    },
  });

  // 3) Ore corsi già lavorate nel mese del turno da sostituire.
  const mese_sostituzione = periodo_mese(sostituzione_per?.data_turno ?? null);
  const ore_query = useQuery({
    queryKey: ["assenze_staff_ore", club_id, mese_sostituzione],
    enabled: !!club_id && !!mese_sostituzione,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ore_lavorate_istruttori")
        .select("istruttore_id, ore_corsi")
        .eq("club_id", club_id)
        .eq("periodo", mese_sostituzione as string);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data ?? []) as any[]) m.set(r.istruttore_id as string, Number(r.ore_corsi ?? 0));
      return m;
    },
  });

  const salva = useMutation({
    mutationFn: async (vars: { dest_id: string; esito: Esito; sostituto_istruttore_id?: string | null; nota?: string | null }) => {
      const esistente = assenze_query.data?.esiti.get(vars.dest_id);
      const { error } = await supabase
        .from("assenze_staff_esiti")
        .upsert(
          {
            club_id,
            destinatario_staff_id: vars.dest_id,
            esito: vars.esito,
            sostituto_istruttore_id:
              vars.sostituto_istruttore_id !== undefined
                ? vars.sostituto_istruttore_id
                : (esistente?.sostituto_istruttore_id ?? null),
            nota: vars.nota !== undefined ? vars.nota : (esistente?.nota ?? null),
            aggiornato_da: session?.user_id ?? null,
            aggiornato_at: new Date().toISOString(),
          },
          { onConflict: "destinatario_staff_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("assenze.salvato") });
      qc.invalidateQueries({ queryKey: ["assenze_staff", club_id] });
    },
    onError: (e: unknown) => {
      segnala_errore("AssenzeStaffPage", "salva_esito_assenza", e);
      toast({ title: t("assenze.errore_salvataggio"), description: messaggio_leggibile(e), variant: "destructive" });
    },
  });

  const righe = assenze_query.data?.righe ?? [];
  const esiti = assenze_query.data?.esiti;

  const esito_di = React.useCallback(
    (r: RigaAssenza): Esito => {
      if (r.rsvp_risposta !== "no") return "ritirata";
      const e = esiti?.get(r.dest_id)?.esito;
      if (e === "presentata" || e === "sostituita" || e === "ritirata") return e;
      return "annunciata";
    },
    [esiti],
  );

  const nel_periodo = React.useCallback(
    (r: RigaAssenza, periodo: "prossimi_7" | "mese" | "tutto") => {
      if (periodo === "tutto") return true;
      if (!r.data_turno) return false;
      if (periodo === "mese") return r.data_turno.slice(0, 7) === oggi.slice(0, 7);
      const limite = new Date(`${oggi}T00:00:00`);
      limite.setDate(limite.getDate() + 7);
      return r.data_turno >= oggi && r.data_turno <= chiave_giorno(limite);
    },
    [oggi],
  );

  const persone_filtro = React.useMemo(() => {
    const m = new Map<string, { nome: string; conteggio: number }>();
    righe.forEach((r: any) => {
      const chiave = r.user_id ?? "senza_accesso";
      const nome = r.nome_persona ?? t("assenze.persona_non_collegata");
      const attuale = m.get(chiave);
      m.set(chiave, { nome, conteggio: (attuale?.conteggio ?? 0) + 1 });
    });
    return [...m.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  }, [righe, t]);

  const visibili = React.useMemo(() => {
    const filtrate = righe.filter(
      (r: any) =>
        nel_periodo(r, filtro_periodo) &&
        (filtro_persona === "tutte" || (r.user_id ?? "senza_accesso") === filtro_persona),
    );
    return [...filtrate].sort((a: any, b: any) => {
      const a_passato = !!a.data_turno && a.data_turno < oggi;
      const b_passato = !!b.data_turno && b.data_turno < oggi;
      if (a_passato !== b_passato) return a_passato ? 1 : -1;
      return String(a.data_turno ?? "9999-99-99").localeCompare(String(b.data_turno ?? "9999-99-99"));
    });
  }, [righe, filtro_periodo, filtro_persona, nel_periodo, oggi]);

  const conta_periodo = (p: "prossimi_7" | "mese" | "tutto") => righe.filter((r) => nel_periodo(r, p)).length;

  const data_lunga = (iso: string) =>
    format_data(new Date(`${iso}T00:00:00`), {
      weekday: "short",
      day: "numeric",
      month: "long",
    });

  const istante = (iso: string | null) =>
    iso ? format_data_ora(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  const nome_istruttore = (id: string | null | undefined) => {
    if (!id) return null;
    const i = (istruttori_query.data ?? []).find((x) => x.id === id);
    return i ? `${i.nome ?? ""} ${i.cognome ?? ""}`.trim() : null;
  };

  const etichetta_esito: Record<Esito, string> = {
    annunciata: t("assenze.esito.annunciata"),
    presentata: t("assenze.esito.presentata"),
    sostituita: t("assenze.esito.sostituita"),
    ritirata: t("assenze.esito.ritirata"),
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <UserX className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("assenze.titolo")}</h1>
          <p className="text-sm text-muted-foreground">{t("assenze.sottotitolo")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtro_periodo} onValueChange={(v) => set_filtro_periodo(v as typeof filtro_periodo)}>
          <SelectTrigger className="h-9 w-auto min-w-[220px]">
            <span className="mr-1 text-muted-foreground">{t("assenze.filtro_periodo")}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prossimi_7">{t("assenze.periodo.prossimi_7", { count: conta_periodo("prossimi_7") })}</SelectItem>
            <SelectItem value="mese">{t("assenze.periodo.mese", { count: conta_periodo("mese") })}</SelectItem>
            <SelectItem value="tutto">{t("assenze.periodo.tutto", { count: conta_periodo("tutto") })}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtro_persona} onValueChange={set_filtro_persona}>
          <SelectTrigger className="h-9 w-auto min-w-[220px]">
            <span className="mr-1 text-muted-foreground">{t("assenze.filtro_persona")}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">{t("assenze.persona_tutte", { count: righe.length })}</SelectItem>
            {persone_filtro.map(([chiave, v]) => (
              <SelectItem key={chiave} value={chiave}>{`${v.nome} (${v.conteggio})`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {assenze_query.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {assenze_query.isError && (
        <Card className="border-destructive/60">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-start">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">{t("assenze.errore_titolo")}</p>
              <p className="text-sm text-muted-foreground">{messaggio_leggibile(assenze_query.error)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => assenze_query.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("assenze.riprova")}
            </Button>
          </CardContent>
        </Card>
      )}

      {assenze_query.isSuccess && visibili.length === 0 && (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={UserX} titolo={t("assenze.vuoto_titolo")} descrizione={t("assenze.vuoto_testo")} />
          </CardContent>
        </Card>
      )}

      {assenze_query.isSuccess &&
        visibili.map((r: any) => {
          const esito = esito_di(r);
          const riga_esito = esiti?.get(r.dest_id);
          const passato = !!r.data_turno && r.data_turno < oggi;
          const gestibile = r.rsvp_risposta === "no";
          const nota_valore = note_locali[r.dest_id] ?? riga_esito?.nota ?? "";
          return (
            <Card key={r.dest_id} className={passato ? "opacity-60" : undefined}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {r.nome_persona ?? t("assenze.persona_non_collegata")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.sessione_mancante
                        ? t("assenze.sessione_mancante")
                        : `${r.data_turno ? data_lunga(r.data_turno) : t("assenze.data_sconosciuta")} · ${r.ora_inizio ?? t("assenze.ora_sconosciuta")} · ${r.nome_corso ?? t("assenze.corso_sconosciuto")}`}
                    </p>
                    {r.rsvp_at && (
                      <p className="text-xs text-muted-foreground">
                        {t("assenze.segnalata_il", { quando: istante(r.rsvp_at) })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={esito === "annunciata" ? "destructive" : "secondary"}>
                      {etichetta_esito[esito]}
                    </Badge>
                    {esito === "sostituita" && nome_istruttore(riga_esito?.sostituto_istruttore_id) && (
                      <span className="text-xs text-muted-foreground">
                        {t("assenze.sostituita_da", { nome: nome_istruttore(riga_esito?.sostituto_istruttore_id) })}
                      </span>
                    )}
                    {passato && <span className="text-xs text-muted-foreground">{t("assenze.turno_passato")}</span>}
                  </div>
                </div>

                {gestibile && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={salva.isPending}
                      onClick={() => salva.mutate({ dest_id: r.dest_id, esito: "presentata", sostituto_istruttore_id: null })}
                    >
                      {t("assenze.azione_presentata")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={salva.isPending}
                      onClick={() => {
                        set_sostituto_scelto(riga_esito?.sostituto_istruttore_id ?? "");
                        set_sostituzione_per(r);
                      }}
                    >
                      {t("assenze.azione_sostituita")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={salva.isPending}
                      onClick={() => salva.mutate({ dest_id: r.dest_id, esito: "annunciata", sostituto_istruttore_id: null })}
                    >
                      {t("assenze.azione_annulla_esito")}
                    </Button>
                  </div>
                )}

                {gestibile && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="h-9 flex-1 min-w-[220px]"
                      placeholder={t("assenze.nota_placeholder")}
                      value={nota_valore}
                      onChange={(e) => set_note_locali((s) => ({ ...s, [r.dest_id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={salva.isPending}
                      onClick={() => salva.mutate({ dest_id: r.dest_id, esito, nota: nota_valore.trim() || null })}
                    >
                      {t("assenze.salva_nota")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

      <Dialog open={!!sostituzione_per} onOpenChange={(v) => { if (!v) set_sostituzione_per(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assenze.sostituto_titolo")}</DialogTitle>
            <DialogDescription>{t("assenze.sostituto_testo")}</DialogDescription>
          </DialogHeader>

          {istruttori_query.isError && (
            <p className="text-sm text-destructive">{t("assenze.sostituto_errore_elenco")}</p>
          )}
          {ore_query.isError && (
            <p className="text-sm text-muted-foreground">{t("assenze.sostituto_errore_ore")}</p>
          )}

          <Select value={sostituto_scelto} onValueChange={set_sostituto_scelto}>
            <SelectTrigger>
              <SelectValue placeholder={t("assenze.sostituto_scegli")} />
            </SelectTrigger>
            <SelectContent>
              {(istruttori_query.data ?? []).map((i) => {
                const ore = ore_query.data?.get(i.id);
                return (
                  <SelectItem key={i.id} value={i.id}>
                    {`${i.nome ?? ""} ${i.cognome ?? ""}`.trim()}
                    {" — "}
                    {ore === undefined
                      ? t("assenze.sostituto_ore_ignote")
                      : t("assenze.sostituto_ore", { ore: ore.toFixed(1) })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => set_sostituzione_per(null)}>
              {t("assenze.sostituto_annulla")}
            </Button>
            <Button
              disabled={!sostituto_scelto || salva.isPending || !istruttori_query.isSuccess}
              onClick={() => {
                const riga = sostituzione_per;
                set_sostituzione_per(null);
                if (riga) {
                  salva.mutate({ dest_id: riga.dest_id, esito: "sostituita", sostituto_istruttore_id: sostituto_scelto });
                }
              }}
            >
              {t("assenze.sostituto_conferma")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
