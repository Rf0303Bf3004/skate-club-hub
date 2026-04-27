import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, User, Calendar as CalIcon, FileText, Trophy, BookOpen, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

// Portale pubblico mobile-first: l'unico identificativo è il portal_token.
// Accetta sia /portale-atleta/:token (path) sia /portale-atleta?token=... (query).

type TabKey = "dati" | "calendario" | "comunicazioni" | "fatture" | "iscrivi";

const PortaleAtletaPage: React.FC = () => {
  const { token: token_param } = useParams<{ token: string }>();
  const [search_params] = useSearchParams();
  const token = token_param || search_params.get("token") || "";
  const [loading, set_loading] = useState(true);
  const [atleta, set_atleta] = useState<any | null>(null);
  const [club, set_club] = useState<any | null>(null);
  const [errore, set_errore] = useState<string | null>(null);
  const [tab, set_tab] = useState<TabKey>("dati");

  // Dati per ogni tab
  const [eventi_calendario, set_eventi_calendario] = useState<any[]>([]);
  const [comunicazioni, set_comunicazioni] = useState<any[]>([]);
  const [fatture, set_fatture] = useState<any[]>([]);
  const [corsi_disponibili, set_corsi_disponibili] = useState<any[]>([]);
  const [iscrizioni_attive, set_iscrizioni_attive] = useState<Set<string>>(new Set());
  const [richieste_inviate, set_richieste_inviate] = useState<Set<string>>(new Set());
  const [busy_id, set_busy_id] = useState<string | null>(null);

  // ── Caricamento iniziale: trova atleta dal token ──
  useEffect(() => {
    (async () => {
      if (!token) {
        set_errore("Link non valido");
        set_loading(false);
        return;
      }
      try {
        const { data: a, error } = await supabase
          .from("atleti")
          .select("*")
          .eq("portal_token", token)
          .maybeSingle();
        if (error) throw error;
        if (!a) {
          set_errore("Link non valido o scaduto");
          set_loading(false);
          return;
        }
        set_atleta(a);
        const { data: c } = await supabase.from("clubs").select("*").eq("id", a.club_id).maybeSingle();
        set_club(c);
      } catch (err: any) {
        set_errore(err?.message || "Errore di caricamento");
      } finally {
        set_loading(false);
      }
    })();
  }, [token]);

  // ── Caricamento dati per tab attivo ──
  useEffect(() => {
    if (!atleta) return;
    (async () => {
      try {
        if (tab === "calendario") {
          const oggi = new Date().toISOString().split("T")[0];
          // Lezioni private
          const { data: lp } = await supabase
            .from("lezioni_private_atlete")
            .select("lezione_id, lezioni_private(*)")
            .eq("atleta_id", atleta.id);
          const lezioni = (lp ?? [])
            .map((x: any) => x.lezioni_private)
            .filter((l: any) => l && !l.annullata && l.data >= oggi)
            .map((l: any) => ({
              tipo: "Lezione privata",
              data: l.data,
              ora_inizio: l.ora_inizio,
              ora_fine: l.ora_fine,
              titolo: "Lezione privata",
            }));
          // Gare
          const { data: ig } = await supabase
            .from("iscrizioni_gare")
            .select("gara_id, gare_calendario(*)")
            .eq("atleta_id", atleta.id);
          const gare = (ig ?? [])
            .map((x: any) => x.gare_calendario)
            .filter((g: any) => g && g.data >= oggi)
            .map((g: any) => ({
              tipo: "Gara",
              data: g.data,
              ora_inizio: null,
              ora_fine: null,
              titolo: g.nome,
              luogo: g.luogo,
            }));
          // Eventi straordinari iscritti
          const { data: ie } = await supabase
            .from("iscrizioni_eventi")
            .select("evento_id, eventi_straordinari(*)")
            .eq("atleta_id", atleta.id);
          const eventi = (ie ?? [])
            .map((x: any) => x.eventi_straordinari)
            .filter((e: any) => e && e.data >= oggi)
            .map((e: any) => ({
              tipo: e.tipo || "Evento",
              data: e.data,
              ora_inizio: e.ora_inizio,
              ora_fine: e.ora_fine,
              titolo: e.titolo,
              luogo: e.luogo,
            }));
          const tutti = [...lezioni, ...gare, ...eventi].sort((a, b) =>
            (a.data + (a.ora_inizio ?? "")).localeCompare(b.data + (b.ora_inizio ?? "")),
          );
          set_eventi_calendario(tutti);
        }

        if (tab === "comunicazioni") {
          const { data: cd } = await supabase
            .from("comunicazioni_destinatari")
            .select("*, comunicazioni(*)")
            .eq("atleta_id", atleta.id)
            .order("creato_at", { ascending: false });
          set_comunicazioni((cd ?? []).filter((x: any) => x.comunicazioni));
        }

        if (tab === "fatture") {
          const { data: f } = await supabase
            .from("fatture")
            .select("*")
            .eq("atleta_id", atleta.id)
            .order("data_emissione", { ascending: false });
          set_fatture(f ?? []);
        }

        if (tab === "iscrivi") {
          const { data: corsi } = await supabase
            .from("corsi")
            .select("*")
            .eq("club_id", atleta.club_id)
            .eq("attivo", true)
            .order("nome");
          set_corsi_disponibili(corsi ?? []);
          const { data: isc } = await supabase
            .from("iscrizioni_corsi")
            .select("corso_id, attiva")
            .eq("atleta_id", atleta.id);
          set_iscrizioni_attive(
            new Set((isc ?? []).filter((x: any) => x.attiva !== false).map((x: any) => x.corso_id)),
          );
          const { data: ric } = await supabase
            .from("richieste_iscrizione")
            .select("corso_id, stato")
            .eq("atleta_id", atleta.id)
            .eq("stato", "in_attesa");
          set_richieste_inviate(new Set((ric ?? []).map((x: any) => x.corso_id)));
        }
      } catch (err) {
        console.error("Errore caricamento tab", err);
      }
    })();
  }, [tab, atleta]);

  const handle_rsvp = async (destinatario_id: string, risposta: "si" | "no") => {
    set_busy_id(destinatario_id);
    try {
      const { error } = await supabase
        .from("comunicazioni_destinatari")
        .update({
          rsvp_risposta: risposta,
          rsvp_at: new Date().toISOString(),
          letto_at: new Date().toISOString(),
        })
        .eq("id", destinatario_id);
      if (error) throw error;
      set_comunicazioni((prev) =>
        prev.map((c) =>
          c.id === destinatario_id
            ? { ...c, rsvp_risposta: risposta, rsvp_at: new Date().toISOString() }
            : c,
        ),
      );
      toast({ title: `✅ Risposta inviata: ${risposta === "si" ? "Sì" : "No"}` });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_busy_id(null);
    }
  };

  const handle_richiedi_iscrizione = async (corso: any) => {
    set_busy_id(corso.id);
    try {
      const { error } = await supabase.from("richieste_iscrizione").insert({
        club_id: atleta.club_id,
        atleta_id: atleta.id,
        corso_id: corso.id,
        stato: "in_attesa",
        note_richiesta: `Richiesta inviata dal portale genitore per ${atleta.nome} ${atleta.cognome}`,
      });
      if (error) throw error;
      set_richieste_inviate((prev) => new Set([...prev, corso.id]));
      toast({ title: "📨 Richiesta inviata", description: `${corso.nome} — l'admin la valuterà` });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_busy_id(null);
    }
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errore || !atleta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3 shadow-card">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Accesso non disponibile</h1>
          <p className="text-sm text-muted-foreground">
            {errore ?? "Il link non è valido. Contatta il club per ricevere un nuovo link."}
          </p>
        </div>
      </div>
    );
  }

  const livello =
    atleta.carriera_artistica || atleta.carriera_stile || atleta.percorso_amatori || "—";
  const nome_completo = `${atleta.nome} ${atleta.cognome}`.trim();
  const iniziali = `${atleta.nome?.[0] ?? ""}${atleta.cognome?.[0] ?? ""}`.toUpperCase();

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "dati", label: "Atleta", icon: User },
    { key: "calendario", label: "Agenda", icon: CalIcon },
    { key: "comunicazioni", label: "Avvisi", icon: BookOpen },
    { key: "fatture", label: "Fatture", icon: FileText },
    { key: "iscrivi", label: "Iscriviti", icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-5 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-foreground/15 flex items-center justify-center text-lg font-bold">
            {iniziali || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Portale atleta</p>
            <h1 className="text-base sm:text-lg font-bold truncate">{nome_completo}</h1>
            {club?.nome && (
              <p className="text-xs text-primary-foreground/80 truncate">{club.nome}</p>
            )}
          </div>
        </div>
      </header>

      {/* Tab bar — orizzontale scrollabile su mobile */}
      <nav className="sticky top-0 z-10 bg-card border-b border-border overflow-x-auto">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => set_tab(t.key)}
                className={`flex-1 min-w-[72px] flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground border-b-2 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-5 sm:px-6 space-y-4">
        {/* ─── DATI ATLETA ─── */}
        {tab === "dati" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-card">
              <h2 className="text-sm font-bold text-foreground mb-3">Dati anagrafici</h2>
              <dl className="space-y-2 text-sm">
                <Row label="Nome">{nome_completo}</Row>
                <Row label="Data di nascita">
                  {atleta.data_nascita
                    ? new Date(atleta.data_nascita + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "—"}
                </Row>
                <Row label="Luogo di nascita">{atleta.luogo_nascita || "—"}</Row>
                <Row label="Indirizzo">{atleta.indirizzo || "—"}</Row>
                <Row label="Telefono">{atleta.telefono || "—"}</Row>
                <Row label="Codice fiscale">{atleta.codice_fiscale || "—"}</Row>
              </dl>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-card">
              <h2 className="text-sm font-bold text-foreground mb-3">Livello tecnico</h2>
              <div className="flex flex-wrap gap-2">
                {atleta.percorso_amatori && (
                  <Badge variant="outline">Amatori: {atleta.percorso_amatori}</Badge>
                )}
                {atleta.carriera_artistica && (
                  <Badge variant="outline">Artistica: {atleta.carriera_artistica}</Badge>
                )}
                {atleta.carriera_stile && (
                  <Badge variant="outline">Stile: {atleta.carriera_stile}</Badge>
                )}
                {!atleta.percorso_amatori && !atleta.carriera_artistica && !atleta.carriera_stile && (
                  <p className="text-sm text-muted-foreground">Nessun livello assegnato</p>
                )}
              </div>
            </div>

            {(atleta.licenza_sis_numero || atleta.licenza_sis_disciplina) && (
              <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                <h2 className="text-sm font-bold text-foreground mb-3">Licenza Swiss Ice Skating</h2>
                <dl className="space-y-2 text-sm">
                  <Row label="Numero">{atleta.licenza_sis_numero || "—"}</Row>
                  <Row label="Disciplina">{atleta.licenza_sis_disciplina || "—"}</Row>
                  <Row label="Categoria">{atleta.licenza_sis_categoria || "—"}</Row>
                  <Row label="Validità">
                    {atleta.licenza_sis_validita_a
                      ? new Date(atleta.licenza_sis_validita_a + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
                      : "—"}
                  </Row>
                </dl>
              </div>
            )}
          </div>
        )}

        {/* ─── CALENDARIO ─── */}
        {tab === "calendario" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Prossimi impegni</h2>
            {eventi_calendario.length === 0 ? (
              <EmptyState icon={CalIcon} text="Nessun impegno futuro programmato" />
            ) : (
              eventi_calendario.map((e, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 shadow-card flex gap-3">
                  <div className="flex flex-col items-center justify-center bg-primary/10 text-primary rounded-lg px-3 py-2 min-w-[60px]">
                    <span className="text-xs uppercase font-bold">
                      {new Date(e.data + "T00:00:00").toLocaleDateString("de-CH", { month: "short" })}
                    </span>
                    <span className="text-xl font-black leading-none">
                      {new Date(e.data + "T00:00:00").getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{e.titolo}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.tipo}
                      {e.ora_inizio && ` · ${e.ora_inizio.slice(0, 5)}`}
                      {e.ora_fine && ` - ${e.ora_fine.slice(0, 5)}`}
                    </p>
                    {e.luogo && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">📍 {e.luogo}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── COMUNICAZIONI ─── */}
        {tab === "comunicazioni" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Avvisi dal club</h2>
            {comunicazioni.length === 0 ? (
              <EmptyState icon={BookOpen} text="Nessun avviso ricevuto" />
            ) : (
              comunicazioni.map((c) => {
                const com = c.comunicazioni;
                const richiede_rsvp = com?.richiede_rsvp;
                const gia_risposto = !!c.rsvp_risposta;
                return (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-bold text-foreground">{com?.titolo}</h3>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(c.creato_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {com?.testo || com?.corpo}
                    </p>
                    {richiede_rsvp && (
                      <div className="mt-3 pt-3 border-t border-border">
                        {gia_risposto ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-success" />
                            <span className="text-muted-foreground">
                              Risposto: <strong className="text-foreground">{c.rsvp_risposta === "si" ? "Sì" : "No"}</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-success hover:bg-success/90 text-white"
                              onClick={() => handle_rsvp(c.id, "si")}
                              disabled={busy_id === c.id}
                            >
                              ✅ Sì, partecipo
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handle_rsvp(c.id, "no")}
                              disabled={busy_id === c.id}
                            >
                              ❌ No
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── FATTURE ─── */}
        {tab === "fatture" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Le tue fatture</h2>
            {fatture.length === 0 ? (
              <EmptyState icon={FileText} text="Nessuna fattura emessa" />
            ) : (
              fatture.map((f) => (
                <div key={f.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{f.numero || "Fattura"}</p>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {f.descrizione || f.tipo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {f.data_emissione
                          ? new Date(f.data_emissione + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-foreground tabular-nums">
                        CHF {Number(f.importo || 0).toFixed(2)}
                      </p>
                      <Badge
                        className={
                          f.pagata
                            ? "bg-success/15 text-success border-success/30"
                            : "bg-warning/15 text-warning border-warning/30"
                        }
                        variant="outline"
                      >
                        {f.pagata ? "Pagata" : "Da pagare"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── ISCRIVITI A NUOVI CORSI ─── */}
        {tab === "iscrivi" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Corsi disponibili</h2>
            <p className="text-xs text-muted-foreground">
              Seleziona un corso per inviare richiesta di iscrizione. L'admin la valuterà e ti risponderà.
            </p>
            {corsi_disponibili.length === 0 ? (
              <EmptyState icon={Trophy} text="Nessun corso disponibile" />
            ) : (
              corsi_disponibili.map((corso) => {
                const gia_iscritto = iscrizioni_attive.has(corso.id);
                const richiesta = richieste_inviate.has(corso.id);
                return (
                  <div key={corso.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground">{corso.nome}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {corso.giorno || "Da pianificare"}
                          {corso.ora_inizio && ` · ${corso.ora_inizio.slice(0, 5)}`}
                          {corso.ora_fine && ` - ${corso.ora_fine.slice(0, 5)}`}
                        </p>
                        {corso.livello_richiesto && corso.livello_richiesto !== "tutti" && (
                          <Badge variant="outline" className="mt-2 text-[10px]">
                            Livello: {corso.livello_richiesto}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary tabular-nums">
                          CHF {Number(corso.costo_mensile || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">/mese</p>
                      </div>
                    </div>
                    {gia_iscritto ? (
                      <Button disabled variant="outline" className="w-full" size="sm">
                        <Check className="w-4 h-4 mr-1" /> Già iscritto
                      </Button>
                    ) : richiesta ? (
                      <Button disabled variant="outline" className="w-full" size="sm">
                        ⏳ Richiesta in attesa
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() => handle_richiedi_iscrizione(corso)}
                        disabled={busy_id === corso.id}
                      >
                        {busy_id === corso.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "📨 Richiedi iscrizione"}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-3 border-b border-border/50 last:border-0 pb-2 last:pb-0">
    <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
    <dd className="text-foreground font-medium text-right break-words">{children}</dd>
  </div>
);

const EmptyState: React.FC<{ icon: any; text: string }> = ({ icon: Icon, text }) => (
  <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
    <Icon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

export default PortaleAtletaPage;
