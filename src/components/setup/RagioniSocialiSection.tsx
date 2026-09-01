import React from "react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import {
  use_ragioni_sociali,
  use_upsert_ragione_sociale,
  use_elimina_ragione_sociale,
  use_listini_ragione_sociale,
  use_upsert_listino,
  use_elimina_listino,
  use_utenti_club_lite,
  use_utenti_ragione_sociale,
  use_toggle_utente_ragione_sociale,
  use_aliquote_iva,
  use_numero_iva_valido,
  type RagioneSociale,
} from "@/hooks/use-ragioni-sociali";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Building2, ChevronDown, ChevronRight, Lock } from "lucide-react";

const maschera_iban = (iban?: string | null) => {
  if (!iban) return "—";
  const clean = iban.replace(/\s/g, "");
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
};

const iniziali = (nome: string) =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

// ─── Sotto-sezione Listini ─────────────────────────────────
const ListiniSubSection: React.FC<{ ragione_sociale_id: string }> = ({ ragione_sociale_id }) => {
  const { data: listini = [], isLoading } = use_listini_ragione_sociale(ragione_sociale_id);
  const upsert = use_upsert_listino();
  const elimina = use_elimina_listino();
  const [edit_id, set_edit_id] = React.useState<string | null>(null);
  const [nome, set_nome] = React.useState("");
  const [prezzo, set_prezzo] = React.useState("");

  const reset = () => {
    set_edit_id(null);
    set_nome("");
    set_prezzo("");
  };

  const salva = async () => {
    if (!nome.trim()) {
      toast({ title: "Inserisci il nome del listino", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        ...(edit_id ? { id: edit_id } : {}),
        ragione_sociale_id,
        nome: nome.trim(),
        prezzo_slot_chf: prezzo === "" ? null : Number(prezzo),
      });
      toast({ title: "Listino salvato" });
      reset();
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Listini</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : listini.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessun listino definito.</p>
      ) : (
        <div className="space-y-1">
          {listini.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-md bg-background px-3 py-2">
              <div className="text-sm">
                <span className="font-medium text-foreground">{l.nome}</span>
                <span className="ml-2 text-muted-foreground tabular-nums">
                  CHF {Number(l.prezzo_slot_chf ?? 0).toFixed(2)} / slot
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    set_edit_id(l.id);
                    set_nome(l.nome);
                    set_prezzo(l.prezzo_slot_chf == null ? "" : String(l.prezzo_slot_chf));
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={async () => {
                    try {
                      await elimina.mutateAsync(l.id);
                      toast({ title: "Listino eliminato" });
                    } catch (e: any) {
                      toast({ title: "Errore", description: e?.message, variant: "destructive" });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-1">
        <div className="flex-1 min-w-[140px]">
          <Label className="text-[11px] text-muted-foreground">Nome listino</Label>
          <Input value={nome} onChange={(e) => set_nome(e.target.value)} placeholder="es. Base" className="h-9" />
        </div>
        <div className="w-32">
          <Label className="text-[11px] text-muted-foreground">Prezzo slot CHF</Label>
          <Input
            type="number"
            step="0.01"
            value={prezzo}
            onChange={(e) => set_prezzo(e.target.value)}
            className="h-9"
          />
        </div>
        <Button size="sm" onClick={salva} disabled={upsert.isPending}>
          {edit_id ? "Aggiorna" : "Aggiungi"}
        </Button>
        {edit_id && (
          <Button size="sm" variant="ghost" onClick={reset}>
            Annulla
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Utenti con accesso dedicato ───────────────────────────
const UtentiAccessoSubSection: React.FC<{ ragione_sociale_id: string }> = ({ ragione_sociale_id }) => {
  const { data: utenti = [], isLoading } = use_utenti_club_lite();
  const { data: assegnati = [] } = use_utenti_ragione_sociale(ragione_sociale_id);
  const toggle = use_toggle_utente_ragione_sociale();

  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Utenti con accesso dedicato</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : utenti.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessun utente del club disponibile.</p>
      ) : (
        <div className="space-y-1">
          {utenti.map((u) => {
            const checked = assegnati.includes(u.id);
            return (
              <label
                key={u.id}
                className="flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={checked}
                  disabled={toggle.isPending}
                  onChange={async (e) => {
                    try {
                      await toggle.mutateAsync({
                        ragione_sociale_id,
                        utente_id: u.id,
                        assegna: e.target.checked,
                      });
                    } catch (err: any) {
                      toast({ title: "Errore", description: err?.message, variant: "destructive" });
                    }
                  }}
                />
                <span className="font-medium text-foreground">
                  {[u.nome, u.cognome].filter(Boolean).join(" ") || u.id.slice(0, 8)}
                </span>
                {u.ruolo && (
                  <Badge variant="outline" className="text-[10px]">
                    {u.ruolo}
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Dialog anagrafica ─────────────────────────────────────
const NOTE_ESENZIONE: Record<string, string> = {
  CH: "Prestazione esclusa dall'imposta — LIVA art. 21 cpv. 2 n. 15",
  IT: "Operazione esente ai sensi dell'art. 10 n. 20 DPR 633/72",
};

const PLACEHOLDER_NUMERO_IVA: Record<string, string> = {
  CH: "CHE-123.456.789 IVA",
  IT: "IT12345678901",
};

const empty_form = {
  nome: "",
  partita_iva: "",
  numero_iva: "",
  indirizzo: "",
  cap: "",
  citta: "",
  paese_iso: "CH",
  email: "",
  telefono: "",
  iban: "",
  intestatario_iban: "",
  banca: "",
  logo_url: "",
  colore_primario: "#3B82F6",
  attivo: true,
  accesso_dedicato: false,
  numero_fattura_prefisso: "",
  soggetto_iva: false,
  iva_aliquota_default: "",
  iva_prezzi_ivati: true,
  iva_esenzione_nota: "",
};

const RagioneSocialeDialog: React.FC<{
  open: boolean;
  on_close: () => void;
  ragione?: RagioneSociale | null;
}> = ({ open, on_close, ragione }) => {
  const upsert = use_upsert_ragione_sociale();
  const [form, set_form] = React.useState<Record<string, any>>(empty_form);
  const [uploading, set_uploading] = React.useState(false);


  React.useEffect(() => {
    if (!open) return;
    set_form(
      ragione
        ? {
            ...empty_form,
            ...Object.fromEntries(Object.entries(ragione).map(([k, v]) => [k, v ?? ""])),
            attivo: ragione.attivo !== false,
            soggetto_iva: (ragione as any).soggetto_iva === true,
            iva_prezzi_ivati: (ragione as any).iva_prezzi_ivati !== false,
          }
        : empty_form,
    );
  }, [open, ragione]);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  const paese = String(form.paese_iso || "CH");
  const { data: aliquote = [] } = use_aliquote_iva(paese);
  const { data: numero_iva_ok } = use_numero_iva_valido(
    String(form.numero_iva || "").trim() || null,
    paese,
  );

  // Preselezione aliquota predefinita quando cambia il paese / arrivano le voci
  React.useEffect(() => {
    if (!form.soggetto_iva || aliquote.length === 0) return;
    const presente = aliquote.some((a) => Number(a.aliquota) === Number(form.iva_aliquota_default));
    if (!presente) {
      const def = aliquote.find((a) => a.predefinita) ?? aliquote[0];
      set_form((p) => ({ ...p, iva_aliquota_default: String(def.aliquota) }));
    }
  }, [aliquote, form.soggetto_iva, form.iva_aliquota_default]);

  const aliquota_scelta = aliquote.find(
    (a) => Number(a.aliquota) === Number(form.iva_aliquota_default),
  );
  const aliquota_num = Number(aliquota_scelta?.aliquota ?? 0);
  const imponibile_esempio = (100 / (1 + aliquota_num / 100)).toFixed(2);
  const iva_esempio = (100 - Number(imponibile_esempio)).toFixed(2);
  const lordo_esempio = (100 * (1 + aliquota_num / 100)).toFixed(2);


  const handle_logo_upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Seleziona un file immagine", variant: "destructive" });
      return;
    }
    set_uploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${get_current_club_id()}/rs-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("loghi-club").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("loghi-club").getPublicUrl(path);
      set_val("logo_url", data.publicUrl);
      toast({ title: "✅ Logo caricato" });
    } catch (err: any) {
      toast({ title: "Errore upload logo", description: err?.message, variant: "destructive" });
    } finally {
      set_uploading(false);
    }
  };

  const salva = async () => {
    if (!String(form.nome).trim()) {
      toast({ title: "Il nome è obbligatorio", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        ...(ragione?.id ? { id: ragione.id } : {}),
        nome: String(form.nome).trim(),
        partita_iva: form.partita_iva || null,
        numero_iva: form.numero_iva || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        paese_iso: form.paese_iso || "CH",
        iban: form.iban || null,
        intestatario_iban: form.intestatario_iban || null,
        banca: form.banca || null,
        logo_url: form.logo_url || null,
        colore_primario: form.colore_primario || "#3B82F6",
        attivo: !!form.attivo,
        accesso_dedicato: !!form.accesso_dedicato,
        numero_fattura_prefisso: form.numero_fattura_prefisso || null,
        email: form.email || null,
        telefono: form.telefono || null,
        soggetto_iva: !!form.soggetto_iva,
        iva_aliquota_default: form.soggetto_iva
          ? form.iva_aliquota_default === "" || form.iva_aliquota_default == null
            ? null
            : Number(form.iva_aliquota_default)
          : null,
        iva_prezzi_ivati: !!form.iva_prezzi_ivati,
        iva_esenzione_nota: form.soggetto_iva ? null : form.iva_esenzione_nota || null,
      } as any);
      toast({ title: "Ragione sociale salvata" });
      on_close();
    } catch (e: any) {
      toast({ title: "Errore", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && on_close()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ragione ? "Modifica ragione sociale" : "Nuova ragione sociale"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input value={form.nome} onChange={(e) => set_val("nome", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Partita IVA</Label>
              <Input value={form.partita_iva} onChange={(e) => set_val("partita_iva", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Numero IVA</Label>
              <Input
                value={form.numero_iva}
                onChange={(e) => set_val("numero_iva", e.target.value)}
                placeholder={PLACEHOLDER_NUMERO_IVA[paese] ?? ""}
              />
              {String(form.numero_iva || "").trim() !== "" && numero_iva_ok === false && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Questo numero non supera la cifra di controllo: verificatelo, altrimenti le fatture non
                  potranno essere emesse.
                </p>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Indirizzo</Label>
            <Input value={form.indirizzo} onChange={(e) => set_val("indirizzo", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">CAP</Label>
              <Input value={form.cap} onChange={(e) => set_val("cap", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Città</Label>
              <Input value={form.citta} onChange={(e) => set_val("citta", e.target.value)} />
            </div>
          </div>
          {/* Sede e recapiti */}
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sede e recapiti</p>
            <div>
              <Label className="text-xs text-muted-foreground">Paese</Label>
              <Select value={paese} onValueChange={(v) => set_val("paese_iso", v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CH">Svizzera</SelectItem>
                  <SelectItem value="IT">Italia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set_val("email", e.target.value)}
                  placeholder="fatture@ente.ch"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefono</Label>
                <Input value={form.telefono} onChange={(e) => set_val("telefono", e.target.value)} />
              </div>
            </div>
          </div>

          <div>

            <Label className="text-xs text-muted-foreground">IBAN</Label>
            <Input value={form.iban} onChange={(e) => set_val("iban", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Intestatario IBAN</Label>
              <Input
                value={form.intestatario_iban}
                onChange={(e) => set_val("intestatario_iban", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Banca</Label>
              <Input value={form.banca} onChange={(e) => set_val("banca", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Logo</Label>
              <div className="flex items-center gap-2">
                {form.logo_url && (
                  <img src={form.logo_url} alt="Logo" className="h-9 w-9 rounded object-cover border border-border" />
                )}
                <Input type="file" accept="image/*" onChange={handle_logo_upload} disabled={uploading} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Colore primario</Label>
              <Input
                type="color"
                value={form.colore_primario || "#3B82F6"}
                onChange={(e) => set_val("colore_primario", e.target.value)}
                className="h-10 w-20 p-1"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.attivo}
              onChange={(e) => set_val("attivo", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Attiva
          </label>

          {/* IVA */}
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">IVA</p>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Questo ente è soggetto a IVA?</p>
              <Switch
                checked={!!form.soggetto_iva}
                onCheckedChange={(v) => {
                  set_form((p) => ({
                    ...p,
                    soggetto_iva: v,
                    iva_esenzione_nota:
                      !v && !String(p.iva_esenzione_nota || "").trim()
                        ? NOTE_ESENZIONE[String(p.paese_iso || "CH")] ?? ""
                        : p.iva_esenzione_nota,
                  }));
                }}
              />
            </div>

            {!form.soggetto_iva ? (
              <div>
                <Label className="text-xs text-muted-foreground">Nota da stampare in fattura</Label>
                <Input
                  value={form.iva_esenzione_nota}
                  onChange={(e) => set_val("iva_esenzione_nota", e.target.value)}
                  placeholder={NOTE_ESENZIONE[paese]}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Aliquota predefinita</Label>
                  <Select
                    value={form.iva_aliquota_default === "" ? undefined : String(form.iva_aliquota_default)}
                    onValueChange={(v) => set_val("iva_aliquota_default", v)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Seleziona un'aliquota" />
                    </SelectTrigger>
                    <SelectContent>
                      {aliquote.map((a) => (
                        <SelectItem key={a.codice} value={String(a.aliquota)}>
                          {a.etichetta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {aliquota_scelta?.descrizione && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{aliquota_scelta.descrizione}</p>
                  )}
                </div>

                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    I prezzi che inserite sono già IVA compresa?
                  </p>
                  <Switch
                    checked={!!form.iva_prezzi_ivati}
                    onCheckedChange={(v) => set_val("iva_prezzi_ivati", v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.iva_prezzi_ivati
                    ? `Un servizio da 100.00 resta 100.00 in fattura: ${imponibile_esempio} di imponibile più ${iva_esempio} di IVA`
                    : `Un servizio da 100.00 diventa ${lordo_esempio} in fattura`}
                </p>
              </>
            )}
          </div>



          {/* Fatturazione */}
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fatturazione</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Prefisso numerazione fatture</Label>
                <Input
                  value={form.numero_fattura_prefisso}
                  onChange={(e) => set_val("numero_fattura_prefisso", e.target.value)}
                  placeholder="es. BM-"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Prossimo numero fattura</Label>
                <p className="mt-2 text-sm font-medium tabular-nums text-foreground">
                  {ragione?.prossimo_numero_fattura ?? 1}
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Accesso dedicato</p>
                <p className="text-xs text-muted-foreground">
                  Se attivo, solo gli utenti assegnati qui sotto potranno vedere e gestire le fatture di questa
                  ragione sociale. Se disattivo, l'accesso è condiviso con segreteria/admin del club come oggi.
                </p>
              </div>
              <Switch
                checked={!!form.accesso_dedicato}
                onCheckedChange={(v) => set_val("accesso_dedicato", v)}
              />
            </div>

            {form.accesso_dedicato &&
              (ragione?.id ? (
                <UtentiAccessoSubSection ragione_sociale_id={ragione.id} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Salva prima la ragione sociale per assegnare gli utenti.
                </p>
              ))}
          </div>
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={on_close}>
            Annulla
          </Button>
          <Button onClick={salva} disabled={upsert.isPending || uploading}>
            {upsert.isPending ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Pallino di stato "pronta a fatturare" ─────────────────
const StatoRagione: React.FC<{ ragione: RagioneSociale }> = ({ ragione }) => {
  const soggetto_iva = (ragione as any).soggetto_iva === true;
  const { data: numero_iva_ok } = use_numero_iva_valido(
    soggetto_iva ? ragione.numero_iva || null : null,
    ragione.paese_iso || "CH",
  );

  const mancanze: string[] = [];
  if (!ragione.iban) mancanze.push("IBAN");
  if (!ragione.indirizzo) mancanze.push("indirizzo");
  if (!ragione.cap) mancanze.push("CAP");
  if (!ragione.citta) mancanze.push("città");
  if (soggetto_iva && (!ragione.numero_iva || numero_iva_ok === false))
    mancanze.push("numero IVA valido");

  const ok = mancanze.length === 0;

  return (
    <>
      <span
        aria-label={ok ? "Pronta a fatturare" : "Dati mancanti"}
        title={ok ? "Pronta a fatturare" : `Manca: ${mancanze.join(", ")}`}
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      {!ok && (
        <p className="mt-0.5 w-full text-xs text-amber-600">Manca: {mancanze.join(", ")}</p>
      )}
    </>
  );
};

// ─── Sezione principale ────────────────────────────────────
export const RagioniSocialiSection: React.FC = () => {
  const { session } = useAuth();
  const allowed = !!session && ["superadmin", "presidente"].includes(session.ruolo);
  const { modalita } = useModalitaArea("fatturazione");
  const { data: ragioni = [], isLoading } = use_ragioni_sociali();
  const elimina = use_elimina_ragione_sociale();
  const [dialog_open, set_dialog_open] = React.useState(false);
  const [edit_ragione, set_edit_ragione] = React.useState<RagioneSociale | null>(null);
  const [expanded, set_expanded] = React.useState<string | null>(null);


  // La sezione è sempre visibile: se la gestione multi-ente non è attiva,
  // mostriamo comunque il selettore di modalità con la spiegazione.
  if (modalita !== "multi_ragione_sociale") {
    return (
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Ragioni sociali</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Il club fattura con un solo ente. Per gestire più ragioni sociali, attivalo in{" "}
          <a
            href="?tab=automatismi"
            className="font-medium text-primary underline underline-offset-2"
          >
            Automatismi &gt; Modalità di gestione
          </a>
          .
        </p>

      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Ragioni sociali</h2>
        </div>
        {allowed ? (
          <Button
            size="sm"
            onClick={() => {
              set_edit_ragione(null);
              set_dialog_open(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nuova ragione sociale
          </Button>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Questa parte la può modificare solo il presidente del club.
          </p>
        )}
      </div>


      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : ragioni.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna ragione sociale configurata. Creane una per iniziare a fatturare con profili distinti.
        </p>
      ) : (
        <div className="space-y-3">
          {ragioni.map((r) => {
            const aperta = expanded === r.id;
            return (
              <div key={r.id} className="rounded-xl border border-border/60 p-3 space-y-3">
                <div className="flex items-start gap-3">
                  {r.logo_url ? (
                    <img src={r.logo_url} alt={r.nome} className="h-10 w-10 rounded-lg object-cover border border-border" />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: r.colore_primario || "#3B82F6" }}
                    >
                      {iniziali(r.nome)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatoRagione ragione={r} />
                      <p className="truncate text-sm font-semibold text-foreground">{r.nome}</p>
                      <Badge variant={r.attivo ? "default" : "outline"} className="text-[10px]">
                        {r.attivo ? "Attiva" : "Disattiva"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      P.IVA {r.partita_iva || "—"} · IBAN {maschera_iban(r.iban)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => set_expanded(aperta ? null : r.id)}>
                      {aperta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    {allowed && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            set_edit_ragione(r);
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
                              toast({ title: "Ragione sociale eliminata" });
                            } catch (e: any) {
                              toast({ title: "Errore", description: e?.message, variant: "destructive" });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>

                </div>

                {aperta && <ListiniSubSection ragione_sociale_id={r.id} />}
              </div>
            );
          })}
        </div>
      )}

      <RagioneSocialeDialog
        open={dialog_open}
        on_close={() => set_dialog_open(false)}
        ragione={edit_ragione}
      />
    </section>
  );
};

export default RagioniSocialiSection;
