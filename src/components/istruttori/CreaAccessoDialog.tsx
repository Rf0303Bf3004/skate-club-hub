import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, KeyRound, Link2, AlertTriangle } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Rimuove accenti e caratteri non alfanumerici da una parte di email. */
export function slug_email_part(v: string): string {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Estrae il dominio dal club (email istituzionale o sito web). */
export function dominio_da_club(club: { email?: string | null; sito_web?: string | null } | null | undefined): string {
  const email = club?.email || "";
  if (email.includes("@")) return email.split("@")[1].trim().toLowerCase();
  const sito = (club?.sito_web || "").trim();
  if (sito) {
    try {
      const url = sito.startsWith("http") ? sito : `https://${sito}`;
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      /* dominio non ricavabile dal sito */
    }
  }
  return "";
}

function genera_password(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

interface Props {
  open: boolean;
  on_close: () => void;
  istruttore: any;
}

const CreaAccessoDialog: React.FC<Props> = ({ open, on_close, istruttore }) => {
  const qc = useQueryClient();
  const club_id = get_current_club_id();
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [ruolo, set_ruolo] = useState("istruttore");
  const [submitting, set_submitting] = useState(false);
  const [esito, set_esito] = useState<{ email: string; password: string } | null>(null);
  const [email_esistente, set_email_esistente] = useState<{ email: string; user_id: string } | null>(null);
  const [email_occupata, set_email_occupata] = useState<string | null>(null);

  const { data: club } = useQuery({
    queryKey: ["club_dominio", club_id],
    enabled: !!club_id && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("email, sito_web").eq("id", club_id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const dominio = useMemo(() => dominio_da_club(club), [club]);

  useEffect(() => {
    if (!open) return;
    set_esito(null);
    set_email_esistente(null);
    set_email_occupata(null);
    set_password(genera_password());
    const liv = istruttore?.livello_istruttore || "istruttore";
    set_ruolo(liv === "aiuto_monitrice" ? "aiuto_monitore" : "istruttore");
    const n = slug_email_part(istruttore?.nome);
    const c = slug_email_part(istruttore?.cognome);
    if (istruttore?.email) set_email(String(istruttore.email).trim().toLowerCase());
    else if (dominio && (n || c)) set_email(`${[n, c].filter(Boolean).join(".")}@${dominio}`);
    else set_email("");
  }, [open, istruttore, dominio]);

  const copia = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success("Copiato");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  /** Cerca fra gli utenti del club uno con la stessa email. */
  const trova_utente_per_email = async (target: string): Promise<string | null> => {
    const { data: righe, error } = await supabase
      .from("utenti_club")
      .select("user_id")
      .eq("club_id", club_id);
    if (error || !righe?.length) return null;
    const { data: sess } = await supabase.auth.getSession();
    const r = await supabase.functions.invoke("manage-user", {
      body: { action: "list_auth_info", club_id, user_ids: righe.map((x: any) => x.user_id) },
      headers: sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
    });
    const users = (r.data as any)?.users as Record<string, { email: string | null }> | undefined;
    if (!users) return null;
    const found = Object.entries(users).find(([, v]) => (v?.email || "").toLowerCase() === target.toLowerCase());
    return found?.[0] ?? null;
  };

  const collega = async (user_id: string) => {
    const { error } = await supabase.from("istruttori").update({ user_id }).eq("id", istruttore.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["istruttori"] });
    return true;
  };

  const conferma = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail.includes("@")) {
      toast.error("Indirizzo email non valido");
      return;
    }
    if (password.trim().length < 8) {
      toast.error("La password deve avere almeno 8 caratteri");
      return;
    }
    set_submitting(true);
    set_email_esistente(null);
    set_email_occupata(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const r = await supabase.functions.invoke("manage-user", {
        body: {
          action: "create",
          club_id,
          email: mail,
          password: password.trim(),
          nome: istruttore?.nome ?? "",
          cognome: istruttore?.cognome ?? "",
          telefono: istruttore?.telefono ?? "",
          ruolo,
        },
        headers: sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
      });
      const err_msg = (r.data as any)?.error || r.error?.message;
      if (err_msg) {
        if (/already|registered|exists|duplicate/i.test(String(err_msg))) {
          const existing = await trova_utente_per_email(mail);
          if (existing) set_email_esistente({ email: mail, user_id: existing });
          else set_email_occupata(mail);
          return;
        }
        throw new Error(String(err_msg));
      }
      const new_user_id = (r.data as any)?.user_id as string;
      if (!new_user_id) throw new Error("Accesso creato ma id utente non restituito");
      const ok = await collega(new_user_id);
      if (!ok) return;
      set_esito({ email: mail, password: password.trim() });
      toast.success("Accesso creato e collegato alla scheda");
    } catch (e: any) {
      toast.error(e?.message || "Errore durante la creazione dell'accesso");
    } finally {
      set_submitting(false);
    }
  };

  const collega_esistente = async () => {
    if (!email_esistente) return;
    set_submitting(true);
    const ok = await collega(email_esistente.user_id);
    set_submitting(false);
    if (ok) {
      toast.success("Accesso esistente collegato alla scheda");
      on_close();
    }
  };

  const nome_completo = `${istruttore?.nome ?? ""} ${istruttore?.cognome ?? ""}`.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && on_close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Crea accesso
          </DialogTitle>
          <DialogDescription>
            {esito
              ? "Accesso creato. Consegna queste credenziali alla persona: la password non sarà più visibile."
              : `Crea l'account del portale per ${nome_completo} e collegalo subito alla scheda.`}
          </DialogDescription>
        </DialogHeader>

        {esito ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Email</span>
                <span className="font-mono">{esito.email}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Password</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{esito.password}</span>
                  <Button size="sm" variant="ghost" onClick={() => copia(esito.password)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              Mostrata una sola volta: copiala e consegnala alla persona.
            </p>
            <DialogFooter>
              <Button onClick={on_close}>Ho copiato, chiudi</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => set_email(e.target.value)} placeholder="nome.cognome@club.ch" />
              {!dominio && (
                <p className="text-xs text-muted-foreground">
                  Nessun dominio del club impostato: scrivi l'indirizzo per intero.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => set_password(e.target.value)} className="font-mono" />
                <Button type="button" variant="outline" size="icon" onClick={() => copia(password)}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => set_password(genera_password())}>
                  Rigenera
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select value={ruolo} onValueChange={set_ruolo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="istruttore">Istruttore</SelectItem>
                  <SelectItem value="aiuto_monitore">Aiuto monitore</SelectItem>
                  <SelectItem value="dt">Direttore tecnico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {email_esistente && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-3 space-y-2">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  Esiste già un accesso con {email_esistente.email}. Lo collego alla scheda di {nome_completo}?
                </p>
                <Button size="sm" onClick={collega_esistente} disabled={submitting} className="gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Collega l'accesso esistente
                </Button>
              </div>
            )}

            {email_occupata && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                L'indirizzo {email_occupata} è già usato da un account che non appartiene a questo club. Scegli
                un'altra email.
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={on_close} disabled={submitting}>
                Annulla
              </Button>
              <Button onClick={conferma} disabled={submitting}>
                {submitting ? "..." : "Conferma"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreaAccessoDialog;
