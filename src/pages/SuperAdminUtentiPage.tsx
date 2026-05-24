import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, RefreshCcw, KeyRound, UserX, UserCheck, ShieldPlus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const RUOLI = ["superadmin", "admin", "presidente", "segreteria", "dt", "istruttore", "aiuto_monitore"];

const SuperAdminUtentiPage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const [loading, set_loading] = useState(true);
  const [utenti, set_utenti] = useState<any[]>([]);
  const [filtro_ruolo, set_filtro_ruolo] = useState<string>("all");
  const [filtro_club, set_filtro_club] = useState<string>("all");
  const [search, set_search] = useState("");
  const [nuovo_open, set_nuovo_open] = useState(false);
  const [pwd_dialog, set_pwd_dialog] = useState<{ open: boolean; pwd: string; user?: string }>({ open: false, pwd: "" });

  const load = async () => {
    set_loading(true);
    const { data, error } = await supabase.functions.invoke("superadmin-utenti", { body: { action: "list" } });
    if (error) { toast.error(error.message); set_loading(false); return; }
    set_utenti((data as any)?.utenti ?? []);
    set_loading(false);
  };

  useEffect(() => { load(); }, []);

  const clubs = Array.from(new Set(utenti.map((u) => u.club_nome).filter(Boolean))).sort();

  const filtered = utenti.filter((u) => {
    if (filtro_ruolo !== "all" && u.ruolo !== filtro_ruolo) return false;
    if (filtro_club !== "all" && u.club_nome !== filtro_club) return false;
    if (search) {
      const q = search.toLowerCase();
      const blob = `${u.email ?? ""} ${u.nome ?? ""} ${u.cognome ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const reset_password = async (u: any) => {
    if (!confirm(`Resettare la password di ${u.email}?`)) return;
    const { data, error } = await supabase.functions.invoke("superadmin-utenti", {
      body: { action: "reset_password", user_id: u.user_id },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.message ?? error?.message ?? "Errore"); return; }
    set_pwd_dialog({ open: true, pwd: (data as any).new_password, user: u.email });
  };

  const toggle_disattivo = async (u: any) => {
    const verb = u.banned ? "Riattivare" : "Disattivare";
    if (!confirm(`${verb} l'utente ${u.email}?`)) return;
    const { error } = await supabase.functions.invoke("superadmin-utenti", {
      body: { action: "set_disattivo", user_id: u.user_id, disattivo: !u.banned },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Aggiornato");
    load();
  };

  const cambia_ruolo = async (u: any, nuovo: string) => {
    const { error } = await supabase.functions.invoke("superadmin-utenti", {
      body: { action: "cambia_ruolo", user_id: u.user_id, ruolo: nuovo },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ruolo aggiornato");
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("utenti.titolo", { defaultValue: "Gestione Utenti" })}</h1>
          <p className="text-sm text-muted-foreground">{t("utenti.sottotitolo", { defaultValue: "Tutti gli utenti del sistema" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="w-4 h-4 mr-1" />Aggiorna</Button>
          <Button className="bg-purple-600 hover:bg-purple-700" size="sm" onClick={() => set_nuovo_open(true)}>
            <ShieldPlus className="w-4 h-4 mr-1" />{t("utenti.nuovo_superadmin", { defaultValue: "Nuovo superadmin" })}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Cerca…" value={search} onChange={(e) => set_search(e.target.value)} className="max-w-xs" />
        <Select value={filtro_ruolo} onValueChange={set_filtro_ruolo}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Ruolo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            {RUOLI.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtro_club} onValueChange={set_filtro_club}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Club" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i club</SelectItem>
            {clubs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Ultimo accesso</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-mono text-xs">{u.email ?? "—"}</TableCell>
                  <TableCell>{[u.nome, u.cognome].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>
                    <Select value={u.ruolo ?? ""} onValueChange={(v) => cambia_ruolo(u, v)}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {RUOLI.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs">{u.club_nome ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("it-CH", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </TableCell>
                  <TableCell>
                    {u.banned ? <span className="text-xs font-bold text-red-600">Disattivato</span> : <span className="text-xs text-emerald-600">Attivo</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Reset password" onClick={() => reset_password(u)}>
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title={u.banned ? "Riattiva" : "Disattiva"} onClick={() => toggle_disattivo(u)}>
                        {u.banned ? <UserCheck className="w-4 h-4 text-emerald-600" /> : <UserX className="w-4 h-4 text-red-600" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessun utente</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <NuovoSuperadminDialog open={nuovo_open} on_close={() => set_nuovo_open(false)} on_done={(pwd, email) => {
        set_nuovo_open(false);
        set_pwd_dialog({ open: true, pwd, user: email });
        load();
      }} />

      <Dialog open={pwd_dialog.open} onOpenChange={(o) => !o && set_pwd_dialog({ open: false, pwd: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Password temporanea</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Comunica questa password all'utente <strong>{pwd_dialog.user}</strong>. Sarà visibile solo ora.
            </p>
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-3">
              <code className="flex-1 font-mono text-base break-all">{pwd_dialog.pwd}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(pwd_dialog.pwd); toast.success("Copiata"); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => set_pwd_dialog({ open: false, pwd: "" })}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const NuovoSuperadminDialog: React.FC<{ open: boolean; on_close: () => void; on_done: (pwd: string, email: string) => void }> = ({ open, on_close, on_done }) => {
  const [email, set_email] = useState("");
  const [nome, set_nome] = useState("");
  const [cognome, set_cognome] = useState("");
  const [busy, set_busy] = useState(false);

  const submit = async () => {
    if (!email || !nome || !cognome) { toast.error("Compila tutti i campi"); return; }
    set_busy(true);
    const { data, error } = await supabase.functions.invoke("superadmin-utenti", {
      body: { action: "crea_superadmin", email, nome, cognome },
    });
    set_busy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.message ?? error?.message ?? "Errore");
      return;
    }
    set_email(""); set_nome(""); set_cognome("");
    on_done((data as any).new_password, email);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && on_close()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuovo superadmin</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => set_email(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => set_nome(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cognome</Label><Input value={cognome} onChange={(e) => set_cognome(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={on_close}>Annulla</Button>
          <Button className="bg-purple-600 hover:bg-purple-700" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SuperAdminUtentiPage;
