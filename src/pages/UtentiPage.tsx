import React, { useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Users, Plus, Pencil, KeyRound, Copy, Search, ArrowUpDown } from "lucide-react";
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

const RUOLI_BASE_VALUES = [
  "presidente",
  "vicepresidente",
  "segreteria",
  "dt",
  "istruttore",
  "aiuto_monitore",
];
const RUOLI_ESTESI_VALUES = [...RUOLI_BASE_VALUES, "admin", "superadmin"];

function build_ruoli_base(t: (k: string) => string) {
  return RUOLI_BASE_VALUES.map((value) => ({ value, label: t(`users.role.${value}`) }));
}
function build_ruoli_estesi(t: (k: string) => string) {
  return RUOLI_ESTESI_VALUES.map((value) => ({ value, label: t(`users.role.${value}`) }));
}

const RUOLO_BADGE: Record<string, string> = {
  presidente: "bg-blue-100 text-blue-700 border-blue-200",
  vicepresidente: "bg-indigo-100 text-indigo-700 border-indigo-200",
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

function format_relative(date_str: string | null | undefined, t: (k: string, opts?: any) => string): string {
  if (!date_str) return t("users.relative_time.never");
  const d = new Date(date_str);
  const now = new Date();
  const diff_min = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff_min < 1) return t("users.relative_time.now");
  if (diff_min < 60) return t("users.relative_time.minutes_ago", { count: diff_min });
  if (diff_min < 60 * 24) return t("users.relative_time.hours_ago", { count: Math.floor(diff_min / 60) });
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
  const { t } = useTranslation("settings");
  const { session } = useAuth();
  const qc = useQueryClient();
  const RUOLI_BASE = useMemo(() => build_ruoli_base(t), [t]);
  const RUOLI_ESTESI = useMemo(() => build_ruoli_estesi(t), [t]);

  // Gestione utenti riservata a superadmin e presidente, come nelle regole del database.
  const allowed = session && ["superadmin", "presidente"].includes(session.ruolo);
  const club_id = session?.club_id;

  const [filtro_ruolo, set_filtro_ruolo] = useState<string>("tutti");
  const [solo_attivi, set_solo_attivi] = useState(true);
  const [search, set_search] = useState("");
  const [ordina_per, set_ordina_per] = useState<"recenti" | "cognome">("recenti");
  const [evidenzia_user_id, set_evidenzia_user_id] = useState<string | null>(null);

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
  const [toggling_user_id, set_toggling_user_id] = useState<string | null>(null);
  const [pwd_dialog, set_pwd_dialog] = useState<{ password: string; nome: string } | null>(null);
  const [link_proposta, set_link_proposta] = useState<{
    istruttore_id: string; nome: string; user_id: string;
  } | null>(null);


  const { data: risultato, isLoading } = useQuery({
    queryKey: ["utenti_club_admin", club_id],
    queryFn: async (): Promise<{ rows: UtenteRow[]; auth_info_ko: boolean }> => {
      if (!club_id) return { rows: [], auth_info_ko: false };
      const { data, error } = await supabase
        .from("utenti_club")
        .select("*")
        .eq("club_id", club_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as UtenteRow[];
      const user_ids = rows.map((r) => r.user_id).filter(Boolean);
      if (user_ids.length === 0) return { rows, auth_info_ko: false };
      try {
        const { data: sess_data } = await supabase.auth.getSession();
        const r = await supabase.functions.invoke("manage-user", {
          body: { action: "list_auth_info", club_id, user_ids },
          headers: sess_data.session ? { Authorization: `Bearer ${sess_data.session.access_token}` } : {},
        });
        if (r.error) throw new Error(r.error.message);
        const map = (r.data as any)?.users;
        if (!map) throw new Error("risposta senza utenti");
        return {
          rows: rows.map((row) => ({
            ...row,
            email: map[row.user_id]?.email ?? undefined,
            last_sign_in_at: map[row.user_id]?.last_sign_in_at ?? null,
          })),
          auth_info_ko: false,
        };
      } catch (e) {
        console.error("[utenti] list_auth_info non riuscito", e);
        return { rows, auth_info_ko: true };
      }
    },
    enabled: !!club_id && !!allowed,
  });

  const utenti = risultato?.rows ?? [];
  const auth_info_ko = !!risultato?.auth_info_ko;

  const filtered = useMemo(() => {
    const out = (utenti ?? []).filter((u) => {
      if (filtro_ruolo !== "tutti" && u.ruolo !== filtro_ruolo) return false;
      if (solo_attivi && !u.attivo) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = `${u.nome ?? ""} ${u.cognome ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    out.sort((a, b) =>
      ordina_per === "cognome"
        ? `${a.cognome ?? ""} ${a.nome ?? ""}`.localeCompare(`${b.cognome ?? ""} ${b.nome ?? ""}`, "it")
        : (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
    return out;
  }, [utenti, filtro_ruolo, solo_attivi, search, ordina_per]);

  /** Righe nascoste dal filtro "solo attivi" (con gli altri filtri già applicati). */
  const nascosti_disattivi = useMemo(() => {
    if (!solo_attivi) return 0;
    return (utenti ?? []).filter((u) => {
      if (u.attivo) return false;
      if (filtro_ruolo !== "tutti" && u.ruolo !== filtro_ruolo) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = `${u.nome ?? ""} ${u.cognome ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).length;
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
      toast.error(t("users.toast.required_fields"));
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
          if (form.password.trim().length < 8) throw new Error(t("users.toast.password_too_short"));
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
        toast.success(t("users.toast.updated", { nome: form.nome, cognome: form.cognome }));
      } else {
        if (!form.email.trim() || !form.password.trim()) {
          toast.error(t("users.toast.email_password_required"));
          set_submitting(false);
          return;
        }
        if (form.password.trim().length < 8) {
          toast.error(t("users.toast.password_too_short"));
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
        const nuovo_user_id = (r.data as any)?.user_id as string | undefined;
        const ruolo_label = t(`users.role.${form.ruolo}`, { defaultValue: form.ruolo });
        toast.success(
          `${form.nome.trim()} ${form.cognome.trim()}: accesso creato come ${ruolo_label}. Lo trovi in cima all'elenco.`,
        );
        if (nuovo_user_id) {
          set_ordina_per("recenti");
          set_search("");
          set_filtro_ruolo("tutti");
          set_evidenzia_user_id(nuovo_user_id);
          setTimeout(() => set_evidenzia_user_id((v) => (v === nuovo_user_id ? null : v)), 6000);
        }

        // Se il ruolo è di pista, proponi il collegamento alla scheda istruttore omonima non collegata
        if (nuovo_user_id && ["istruttore", "aiuto_monitore"].includes(form.ruolo)) {
          const { data: schede } = await supabase
            .from("istruttori")
            .select("id, nome, cognome, user_id")
            .eq("club_id", club_id)
            .is("user_id", null);
          const match = (schede ?? []).find(
            (s: any) =>
              (s.nome ?? "").trim().toLowerCase() === form.nome.trim().toLowerCase() &&
              (s.cognome ?? "").trim().toLowerCase() === form.cognome.trim().toLowerCase(),
          );
          if (match) {
            set_link_proposta({
              istruttore_id: match.id,
              nome: `${match.nome ?? ""} ${match.cognome ?? ""}`.trim(),
              user_id: nuovo_user_id,
            });
          }
        }

      }
      set_dialog_open(false);
      qc.invalidateQueries({ queryKey: ["utenti_club_admin", club_id] });
    } catch (e: any) {
      toast.error(e?.message || t("users.toast.generic_error"));
    } finally {
      set_submitting(false);
    }
  };

  const do_toggle_attivo = async (u: UtenteRow) => {
    if (u.user_id === session?.user_id) {
      toast.error("Non puoi disattivare il tuo stesso accesso.");
      set_confirm_state(null);
      return;
    }
    set_toggling_user_id(u.user_id);
    try {
      const { error } = await supabase
        .from("utenti_club")
        .update({ attivo: !u.attivo })
        .eq("id", u.id);
      if (error) throw error;
      toast.success(u.attivo ? t("users.toast.deactivated") : t("users.toast.reactivated"));
      qc.invalidateQueries({ queryKey: ["utenti_club_admin", club_id] });
    } catch (e: any) {
      toast.error(e?.message || t("users.toast.generic_error"));
    } finally {
      set_toggling_user_id(null);
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
      toast.error(e?.message || t("users.toast.generic_error"));
      set_confirm_state(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("users.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("users.subtitle")}</p>
          </div>
        </div>
        <Button onClick={open_create} className="gap-2">
          <Plus className="w-4 h-4" /> {t("users.new_user")}
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("users.search_placeholder")}
            value={search}
            onChange={(e) => set_search(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtro_ruolo} onValueChange={set_filtro_ruolo}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">{t("users.all_roles")}</SelectItem>
            {RUOLI_ESTESI.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={solo_attivi} onCheckedChange={set_solo_attivi} id="solo-attivi" />
          <Label htmlFor="solo-attivi" className="text-sm">{t("users.only_active")}</Label>
          {nascosti_disattivi > 0 && (
            <span className="text-xs text-amber-700">
              {nascosti_disattivi === 1
                ? "1 utente disattivato nascosto"
                : `${nascosti_disattivi} utenti disattivati nascosti`}
            </span>
          )}
        </div>
      </div>

      {auth_info_ko && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Non riesco a leggere email e ultimo accesso degli utenti: i campi restano vuoti.
        </div>
      )}

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
                  <TableHead>{t("users.table.nome")}</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => set_ordina_per(ordina_per === "cognome" ? "recenti" : "cognome")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      title="Ordina per cognome"
                    >
                      {t("users.table.cognome")}
                      <ArrowUpDown className={`w-3 h-3 ${ordina_per === "cognome" ? "text-primary" : "opacity-50"}`} />
                    </button>
                  </TableHead>
                  <TableHead>{t("users.table.email")}</TableHead>
                  <TableHead>{t("users.table.telefono")}</TableHead>
                  <TableHead>{t("users.table.ruolo")}</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => set_ordina_per("recenti")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      title="Ordina dai più recenti"
                    >
                      {t("users.table.last_access")}
                      <ArrowUpDown className={`w-3 h-3 ${ordina_per === "recenti" ? "text-primary" : "opacity-50"}`} />
                    </button>
                  </TableHead>
                  <TableHead className="text-center">{t("users.table.accesso_attivo", { defaultValue: "Accesso attivo" })}</TableHead>
                  <TableHead className="text-right">{t("users.table.azioni")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      {t("users.none_found")}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow
                    key={u.id}
                    ref={
                      u.user_id === evidenzia_user_id
                        ? (el) => el?.scrollIntoView({ block: "center", behavior: "smooth" })
                        : undefined
                    }
                    className={
                      u.user_id === evidenzia_user_id
                        ? "bg-amber-100 ring-2 ring-amber-400 transition-colors"
                        : ""
                    }
                  >
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
                        {t(`users.role.${u.ruolo}`, { defaultValue: u.ruolo })}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format_relative(u.last_sign_in_at, t)}</TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const is_self = u.user_id === session?.user_id;
                        return (
                          <span title={is_self ? "Non puoi disattivare il tuo stesso accesso" : ""}>
                            <Switch
                              checked={!!u.attivo}
                              disabled={!!toggling_user_id || is_self}
                              onCheckedChange={() => set_confirm_state({ type: "toggle", user: u })}
                            />
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => open_edit(u)} title={t("users.tooltip.modifica")}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => set_confirm_state({ type: "reset", user: u })} title={t("users.tooltip.reset_password")}>
                          <KeyRound className="w-4 h-4" />
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
              <p className="text-center text-sm text-muted-foreground py-8">{t("users.none_found")}</p>
            )}
            {filtered.map((u) => (
              <div key={u.id} className="bg-card rounded-xl shadow-card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{u.nome} {u.cognome}</p>
                    <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${RUOLO_BADGE[u.ruolo] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {t(`users.role.${u.ruolo}`, { defaultValue: u.ruolo })}
                  </span>
                </div>
                {u.telefono && (
                  <a href={`tel:${u.telefono}`} className="text-sm text-primary block">{u.telefono}</a>
                )}
                <p className="text-[11px] text-muted-foreground">{t("users.table.last_access")}: {format_relative(u.last_sign_in_at, t)}</p>
                <div className="flex items-center justify-between pt-1">
                  {(() => {
                    const is_self = u.user_id === session?.user_id;
                    return (
                      <div className="flex items-center gap-2 text-xs">
                        <span title={is_self ? "Non puoi disattivare il tuo stesso accesso" : ""}>
                          <Switch
                            checked={!!u.attivo}
                            disabled={!!toggling_user_id || is_self}
                            onCheckedChange={() => set_confirm_state({ type: "toggle", user: u })}
                          />
                        </span>
                        <span>{u.attivo ? t("users.status.attivo") : t("users.status.disattivato")}</span>
                      </div>
                    );
                  })()}
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => open_edit(u)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => set_confirm_state({ type: "reset", user: u })}><KeyRound className="w-4 h-4" /></Button>
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
            <DialogTitle>{edit_user ? t("users.modal.edit_title") : t("users.modal.create_title")}</DialogTitle>
            <DialogDescription>
              {edit_user ? t("users.modal.edit_description") : t("users.modal.create_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("users.modal.field_nome")}</Label>
                <Input value={form.nome} onChange={(e) => set_form({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label>{t("users.modal.field_cognome")}</Label>
                <Input value={form.cognome} onChange={(e) => set_form({ ...form, cognome: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("users.modal.field_email")}</Label>
              <Input
                type="email"
                value={form.email}
                disabled={!!edit_user}
                onChange={(e) => set_form({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("users.modal.field_telefono")}</Label>
              <Input value={form.telefono} onChange={(e) => set_form({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>{edit_user ? t("users.modal.field_password_edit") : t("users.modal.field_password_create")}</Label>
              <Input value={form.password} onChange={(e) => set_form({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label>{t("users.modal.field_ruolo")}</Label>
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
                <Label htmlFor="attivo-switch" className="text-sm">{t("users.modal.field_attivo")}</Label>
                <Switch
                  id="attivo-switch"
                  checked={form.attivo}
                  onCheckedChange={(v) => set_form({ ...form, attivo: v })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_dialog_open(false)}>{t("users.modal.cancel")}</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? t("users.modal.saving") : (edit_user ? t("users.modal.save_edit") : t("users.modal.save_create"))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirm_state} onOpenChange={(o) => !o && set_confirm_state(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm_state?.type === "reset" && t("users.confirm.reset_title")}
              {confirm_state?.type === "toggle" && (confirm_state.user.attivo ? t("users.confirm.deactivate_title") : t("users.confirm.reactivate_title"))}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm_state?.type === "reset" && (
                <Trans
                  i18nKey="users.confirm.reset_description"
                  ns="settings"
                  values={{ nome: `${confirm_state.user.nome ?? ""} ${confirm_state.user.cognome ?? ""}`.trim() }}
                  components={{ strong: <strong /> }}
                />
              )}
              {confirm_state?.type === "toggle" && confirm_state.user.attivo && (
                <>
                  <p>
                    Stai per disattivare <strong>{`${confirm_state.user.nome ?? ""} ${confirm_state.user.cognome ?? ""}`.trim()}</strong>.
                  </p>
                  <p className="mt-2">
                    Non potrà più entrare nel portale. I suoi dati e il suo storico restano.
                  </p>
                </>
              )}
              {confirm_state?.type === "toggle" && !confirm_state.user.attivo && (
                <Trans
                  i18nKey="users.confirm.reactivate_description"
                  ns="settings"
                  values={{ nome: `${confirm_state.user.nome ?? ""} ${confirm_state.user.cognome ?? ""}`.trim() }}
                  components={{ strong: <strong /> }}
                />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("users.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm_state) return;
                if (confirm_state.type === "reset") do_reset_password(confirm_state.user);
                else do_toggle_attivo(confirm_state.user);
              }}
            >
              {t("users.confirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New password dialog */}
      <Dialog open={!!pwd_dialog} onOpenChange={(o) => !o && set_pwd_dialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.password_dialog.title")}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="users.password_dialog.description"
                ns="settings"
                values={{ nome: pwd_dialog?.nome ?? "" }}
                components={{ strong: <strong /> }}
              />
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
                  toast.success(t("users.toast.password_copied"));
                }
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => set_pwd_dialog(null)}>{t("users.password_dialog.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposta di collegamento accesso ↔ scheda istruttore */}
      <AlertDialog open={!!link_proposta} onOpenChange={(v) => !v && set_link_proposta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Collego questo accesso alla scheda di {link_proposta?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esiste una scheda istruttore con lo stesso nome e cognome, ancora senza accesso. Se la collego, la
              persona vedrà i suoi turni e riceverà le comunicazioni.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non ora</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!link_proposta) return;
                const { error } = await supabase
                  .from("istruttori")
                  .update({ user_id: link_proposta.user_id })
                  .eq("id", link_proposta.istruttore_id);
                if (error) toast.error(error.message);
                else {
                  toast.success("Scheda collegata all'accesso");
                  qc.invalidateQueries({ queryKey: ["istruttori"] });
                }
                set_link_proposta(null);
              }}
            >
              Sì, collega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


export default UtentiPage;
