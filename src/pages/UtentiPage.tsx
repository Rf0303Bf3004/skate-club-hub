import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Users, Plus, Pencil, KeyRound, Power, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

const RUOLI_BASE = [
  { value: "presidente", label: "Presidente" },
  { value: "segreteria", label: "Segreteria" },
  { value: "dt", label: "Direttore Tecnico" },
  { value: "istruttore", label: "Istruttore" },
  { value: "aiuto_monitore", label: "Aiuto Monitore" },
];
const RUOLI_ESTESI = [
  ...RUOLI_BASE,
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];

const RUOLO_LABEL: Record<string, string> = Object.fromEntries(
  RUOLI_ESTESI.map((r) => [r.value, r.label]),
);

const RUOLO_BADGE: Record<string, string> = {
  presidente: "bg-blue-100 text-blue-700 border-blue-200",
  segreteria: "bg-amber-100 text-amber-700 border-amber-200",
  dt: "bg-emerald-100 text-emerald-700 border-emerald-200",
  istruttore: "bg-purple-100 text-purple-700 border-purple-200",
  aiuto_monitore: "bg-cyan-100 text-cyan-700 border-cyan-200",
  admin: "bg-red-100 text-red-700 border-red-200",
  superadmin: "bg-red-200 text-red-900 border-red-300",
};

interface UtenteRow {
  id: string;
  user_id: string;
  club_id: string;
  ruolo: string;
  nome: string | null;
  cognome: string | null;
  telefono?: string | null;
  attivo: boolean | null;
  created_at: string;
  email?: string;
  last_sign_in_at?: string | null;
}

function format_relative(date_str?: string | null): string {
  if (!date_str) return "mai";
  const d = new Date(date_str);
  const now = new Date();
  const diff_min = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff_min < 1) return "ora";
  if (diff_min < 60) return `${diff_min} min fa`;
  if (diff_min < 60 * 24) return `${Math.floor(diff_min / 60)} ore fa`;
  return d.toLocaleString("it-IT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function rand_password(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
  let s = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}

const UtentiPage: React.FC = () => {
  const { session } = useAuth();
  const qc = useQueryClient();

  const allowed = session && ["superadmin", "admin", "presidente"].includes(session.ruolo);
  const club_id = session?.club_id;

  const [filtro_ruolo, set_filtro_ruolo] = useState<string>("tutti");
  const [solo_attivi, set_solo_attivi] = useState(true);
  const [search, set_search] = useState("");

  const [dialog_open, set_dialog_open] = useState(false);
  const [edit_user, set_edit_user] = useState<UtenteRow | null>(null);
  const [form, set_form] = useState({
    nome: "", cognome: "", email: "", telefono: "", password: "IceArena2026!",
    ruolo: "istruttore", attivo: true,
  });
  const [submitting, set_submitting] = useState(false);

  const [confirm_state, set_confirm_state] = useState<{
    type: "toggle" | "reset"; user: UtenteRow;
  } | null>(null);
  const [pwd_dialog, set_pwd_dialog] = useState<{ password: string; nome: string } | null>(null);

  const { data: utenti = [], isLoading } = useQuery({
    queryKey: ["utenti_club_admin", club_id],
    queryFn: async () => {
      if (!club_id) return [];
      const { data, error } = await supabase
        .from("utenti_club")
        .select("*")
        .eq("club_id", club_id)
        .order("cognome", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as UtenteRow[];
      const user_ids = rows.map((r) => r.user_id).filter(Boolean);
      if (user_ids.length === 0) return rows;
      try {
        const { data: sess_data } = await supabase.auth.getSession();
        const r = await supabase.functions.invoke("manage-user", {
          body: { action: "list_auth_info", club_id, user_ids },
          headers: sess_data.session ? { Authorization: `Bearer ${sess_data.session.access_token}` } : {},
        });
        const map = (r.data as any)?.users ?? {};
        return rows.map((row) => ({
          ...row,
          email: map[row.user_id]?.email ?? undefined,
          last_sign_in_at: map[row.user_id]?.last_sign_in_at ?? null,
        }));
      } catch {
        return rows;
      }
    },
    enabled: !!club_id && !!allowed,
  });

  const filtered = useMemo(() => {
    return (utenti ?? []).filter((u) => {
      if (filtro_ruolo !== "tutti" && u.ruolo !== filtro_ruolo) return false;
      if (solo_attivi && !u.attivo) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = `${u.nome ?? ""} ${u.cognome ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [utenti, filtro_ruolo, solo_attivi, search]);

  if (!session) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const open_create = () => {
    set_edit_user(null);
    set_form({
      nome: "", cognome: "", email: "", telefono: "",
      password: "IceArena2026!", ruolo: "istruttore", attivo: true,
    });
    set_dialog_open(true);
  };

  const open_edit = (u: UtenteRow) => {
    set_edit_user(u);
    set_form({
      nome: u.nome ?? "",
      cognome: u.cognome ?? "",
      email: u.email ?? "",
      telefono: u.telefono ?? "",
      password: "",
      ruolo: u.ruolo,
      attivo: !!u.attivo,
    });
    set_dialog_open(true);
  };

  const submit = async () => {
    if (!club_id) return;
    if (!form.nome.trim() || !form.cognome.trim() || !form.ruolo) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    set_submitting(true);
    try {
      if (edit_user) {
        const { error } = await supabase
          .from("utenti_club")
          .update({
            nome: form.nome.trim(),
            cognome: form.cognome.trim(),
            telefono: form.telefono.trim(),
            ruolo: form.ruolo,
            attivo: form.attivo,
          })
          .eq("id", edit_user.id);
        if (error) throw error;

        if (form.password.trim()) {
          if (form.password.trim().length < 8) throw new Error("Password troppo corta (min 8)");
          const { data: sess_data } = await supabase.auth.getSession();
          const r = await supabase.functions.invoke("manage-user", {
            body: {
              action: "update_password",
              club_id,
              user_id: edit_user.user_id,
              password: form.password.trim(),
            },
            headers: sess_data.session ? { Authorization: `Bearer ${sess_data.session.access_token}` } : {},
          });
          if (r.error) throw new Error(r.error.message);
          if ((r.data as any)?.error) throw new Error((r.data as any).error);
        }
        toast.success(`Utente ${form.nome} ${form.cognome} aggiornato`);
      } else {
        if (!form.email.trim() || !form.password.trim()) {
          toast.error("Email e password obbligatorie");
          set_submitting(false);
          return;
        }
        if (form.password.trim().length < 8) {
          toast.error("Password troppo corta (min 8)");
          set_submitting(false);
          return;
        }
        const { data: sess_data } = await supabase.auth.getSession();
        const r = await supabase.functions.invoke("manage-user", {
          body: {
            action: "create",
            club_id,
            email: form.email.trim(),
            password: form.password.trim(),
            nome: form.nome.trim(),
            cognome: form.cognome.trim(),
            telefono: form.telefono.trim(),
            ruolo: form.ruolo,
          },
          headers: sess_data.session ? { Authorization: `Bearer ${sess_data.session.access_token}` } : {},
        });
        if (r.error) throw new Error(r.error.message);
        if ((r.data as any)?.error) throw new Error((r.data as any).error);
        toast.success(`Utente ${form.nome} ${form.cognome} creato. Password: ${form.password}`);
      }
      set_dialog_open(false);
      qc.invalidateQueries({ queryKey: ["utenti_club_admin", club_id] });
    } catch (e: any) {
      toast.error(e?.message || "Errore");
    } finally {
      set_submitting(false);
    }
  };

  const do_toggle_attivo = async (u: UtenteRow) => {
    try {
      const { error } = await supabase
        .from("utenti_club")
        .update({ attivo: !u.attivo })
        .eq("id", u.id);
      if (error) throw error;
      toast.success(u.attivo ? "Utente disattivato" : "Utente riattivato");
      qc.invalidateQueries({ queryKey: ["utenti_club_admin", club_id] });
    } catch (e: any) {
      toast.error(e?.message || "Errore");
    } finally {
      set_confirm_state(null);
    }
  };

  const do_reset_password = async (u: UtenteRow) => {
    try {
      const new_pwd = rand_password(12);
      const { data: sess_data } = await supabase.auth.getSession();
      const r = await supabase.functions.invoke("manage-user", {
        body: {
          action: "update_password",
          club_id,
          user_id: u.user_id,
          password: new_pwd,
        },
        headers: sess_data.session ? { Authorization: `Bearer ${sess_data.session.access_token}` } : {},
      });
      if (r.error) throw new Error(r.error.message);
      if ((r.data as any)?.error) throw new Error((r.data as any).error);
      set_confirm_state(null);
      set_pwd_dialog({ password: new_pwd, nome: `${u.nome ?? ""} ${u.cognome ?? ""}`.trim() });
    } catch (e: any) {
      toast.error(e?.message || "Errore");
      set_confirm_state(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Gestione Utenti</h1>
            <p className="text-sm text-muted-foreground">Crea e gestisci gli utenti del club</p>
          </div>
        </div>
        <Button onClick={open_create} className="gap-2">
          <Plus className="w-4 h-4" /> Nuovo utente
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, cognome o email"
            value={search}
            onChange={(e) => set_search(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtro_ruolo} onValueChange={set_filtro_ruolo}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i ruoli</SelectItem>
            {RUOLI_ESTESI.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={solo_attivi} onCheckedChange={set_solo_attivi} id="solo-attivi" />
          <Label htmlFor="solo-attivi" className="text-sm">Solo attivi</Label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="bg-card rounded-xl shadow-card overflow-hidden hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>Cognome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Ultimo accesso</TableHead>
                  <TableHead className="text-center">Attivo</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      Nessun utente trovato
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell className="font-medium">{u.cognome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {u.telefono ? (
                        <a href={`tel:${u.telefono}`} className="text-primary hover:underline">{u.telefono}</a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${RUOLO_BADGE[u.ruolo] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {RUOLO_LABEL[u.ruolo] ?? u.ruolo}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format_relative(u.last_sign_in_at)}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={!!u.attivo} disabled />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => open_edit(u)} title="Modifica">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => set_confirm_state({ type: "reset", user: u })} title="Reset password">
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => set_confirm_state({ type: "toggle", user: u })} title={u.attivo ? "Disattiva" : "Riattiva"}>
                          <Power className={`w-4 h-4 ${u.attivo ? "text-emerald-600" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nessun utente trovato</p>
            )}
            {filtered.map((u) => (
              <div key={u.id} className="bg-card rounded-xl shadow-card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{u.nome} {u.cognome}</p>
                    <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${RUOLO_BADGE[u.ruolo] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {RUOLO_LABEL[u.ruolo] ?? u.ruolo}
                  </span>
                </div>
                {u.telefono && (
                  <a href={`tel:${u.telefono}`} className="text-sm text-primary block">{u.telefono}</a>
                )}
                <p className="text-[11px] text-muted-foreground">Ultimo accesso: {format_relative(u.last_sign_in_at)}</p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Switch checked={!!u.attivo} disabled />
                    <span>{u.attivo ? "Attivo" : "Disattivato"}</span>
                  </div>
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => open_edit(u)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => set_confirm_state({ type: "reset", user: u })}><KeyRound className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => set_confirm_state({ type: "toggle", user: u })}>
                      <Power className={`w-4 h-4 ${u.attivo ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialog_open} onOpenChange={set_dialog_open}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit_user ? "Modifica utente" : "Nuovo utente"}</DialogTitle>
            <DialogDescription>
              {edit_user ? "Aggiorna i dati dell'utente." : "Crea un nuovo utente del club."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => set_form({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label>Cognome *</Label>
                <Input value={form.cognome} onChange={(e) => set_form({ ...form, cognome: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                disabled={!!edit_user}
                onChange={(e) => set_form({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefono</Label>
              <Input value={form.telefono} onChange={(e) => set_form({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>{edit_user ? "Nuova password (lascia vuoto per non cambiare)" : "Password iniziale *"}</Label>
              <Input value={form.password} onChange={(e) => set_form({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label>Ruolo *</Label>
              <Select value={form.ruolo} onValueChange={(v) => set_form({ ...form, ruolo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RUOLI_BASE.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {edit_user && (
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor="attivo-switch" className="text-sm">Attivo</Label>
                <Switch
                  id="attivo-switch"
                  checked={form.attivo}
                  onCheckedChange={(v) => set_form({ ...form, attivo: v })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_dialog_open(false)}>Annulla</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Salvataggio..." : (edit_user ? "Salva modifiche" : "Crea utente")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirm_state} onOpenChange={(o) => !o && set_confirm_state(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm_state?.type === "reset" && "Reset password"}
              {confirm_state?.type === "toggle" && (confirm_state.user.attivo ? "Disattivare utente" : "Riattivare utente")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm_state?.type === "reset" && (
                <>Vuoi resettare la password di <strong>{confirm_state.user.nome} {confirm_state.user.cognome}</strong>? La nuova password sarà mostrata una sola volta.</>
              )}
              {confirm_state?.type === "toggle" && confirm_state.user.attivo && (
                <>Disattivare <strong>{confirm_state.user.nome} {confirm_state.user.cognome}</strong>? Non potrà più accedere al portale.</>
              )}
              {confirm_state?.type === "toggle" && !confirm_state.user.attivo && (
                <>Riattivare <strong>{confirm_state.user.nome} {confirm_state.user.cognome}</strong>? Potrà accedere di nuovo al portale.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm_state) return;
                if (confirm_state.type === "reset") do_reset_password(confirm_state.user);
                else do_toggle_attivo(confirm_state.user);
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New password dialog */}
      <Dialog open={!!pwd_dialog} onOpenChange={(o) => !o && set_pwd_dialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova password generata</DialogTitle>
            <DialogDescription>
              Comunica questa password a <strong>{pwd_dialog?.nome}</strong>. Non sarà più visibile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={pwd_dialog?.password ?? ""} readOnly className="font-mono" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (pwd_dialog) {
                  navigator.clipboard.writeText(pwd_dialog.password);
                  toast.success("Password copiata");
                }
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => set_pwd_dialog(null)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UtentiPage;
