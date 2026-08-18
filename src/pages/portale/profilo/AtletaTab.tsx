import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, IdCard, Trophy, Users, Mail, Phone, Sparkles, Camera, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortaleSession } from "@/lib/portale-auth";

const MAX_BYTES = 2 * 1024 * 1024;
const TIPI_OK = ["image/jpeg", "image/jpg", "image/png"];

interface Ctx {
  session: PortaleSession;
  atleta?: any;
}

const Row: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <div className="flex justify-between items-baseline gap-4 border-b border-slate-100 py-3 last:border-0">
    <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</dt>
    <dd className={`text-sm font-semibold text-slate-800 text-right ${mono ? "font-mono" : ""}`}>{children}</dd>
  </div>
);

const SectionCard: React.FC<{
  icon: React.ElementType;
  title: string;
  gradient: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, gradient, children }) => (
  <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
      </div>
      {children}
    </div>
  </div>
);

const GenitoreCard: React.FC<{
  nome?: string; cognome?: string; email?: string; tel?: string;
  indirizzo?: string; cap?: string; citta?: string; cantone?: string;
  idx: number;
}> = ({ nome, cognome, email, tel, indirizzo, cap, citta, cantone, idx }) => {
  const display = [nome, cognome].filter(Boolean).join(" ") || email || "Genitore";
  const ini = `${nome?.[0] ?? ""}${cognome?.[0] ?? ""}`.toUpperCase() || (email?.[0] ?? "?").toUpperCase();
  const gradient = idx === 0 ? "from-sky-500 to-indigo-500" : "from-violet-500 to-purple-600";
  const addr = [indirizzo, [cap, citta].filter(Boolean).join(" "), cantone].filter(Boolean).join(", ");
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold shadow-sm shrink-0`}>
        {ini}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 truncate">{display}</p>
        <div className="flex flex-col gap-1 mt-1.5">
          {email && (
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{email}</span>
            </a>
          )}
          {tel && (
            <a href={`tel:${tel}`} className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700">
              <Phone className="w-3.5 h-3.5 shrink-0" /> {tel}
            </a>
          )}
          {addr && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{addr}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const AtletaTab: React.FC = () => {
  const ctx = useOutletContext<Ctx>();
  const [atleta, set_atleta] = useState<any | null>(ctx?.atleta ?? null);
  const [loading, set_loading] = useState(!ctx?.atleta);
  const [saving, set_saving] = useState(false);
  const [uploading, set_uploading] = useState(false);
  const input_file = useRef<HTMLInputElement>(null);

  const [form, set_form] = useState({
    indirizzo: "", cap: "", citta: "", cantone: "", telefono: "",
    genitore_email: "", genitore_telefono: "",
  });

  const applica_form = (a: any) => {
    const usa_g2 = !a?.genitore1_nome && !a?.genitore1_email && !!(a?.genitore2_nome || a?.genitore2_email);
    set_form({
      indirizzo: a?.indirizzo ?? "",
      cap: a?.cap ?? "",
      citta: a?.citta ?? "",
      cantone: a?.cantone ?? "",
      telefono: a?.telefono ?? "",
      genitore_email: (usa_g2 ? a?.genitore2_email : a?.genitore1_email) ?? "",
      genitore_telefono: (usa_g2 ? a?.genitore2_telefono : a?.genitore1_telefono) ?? "",
    });
  };

  useEffect(() => {
    if (ctx?.atleta) {
      set_atleta(ctx.atleta);
      applica_form(ctx.atleta);
      set_loading(false);
      return;
    }
    (async () => {
      const id = ctx?.session?.atleta?.id;
      if (!id) { set_loading(false); return; }
      const { data } = await supabase.from("atleti").select("*").eq("id", id).maybeSingle();
      set_atleta(data);
      applica_form(data);
      set_loading(false);
    })();
  }, [ctx]);

  const usa_g2 = !!atleta && !atleta.genitore1_nome && !atleta.genitore1_email && !!(atleta.genitore2_nome || atleta.genitore2_email);

  const on_file = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!TIPI_OK.includes(f.type)) { toast.error("Sono accettati solo file JPG o PNG"); return; }
    if (f.size > MAX_BYTES) { toast.error("Il file supera i 2MB, scegli una foto più leggera"); return; }
    set_uploading(true);
    const fd = new FormData();
    fd.append("codice_atleta", atleta?.codice_atleta ?? ctx?.session?.atleta?.codice_atleta ?? "");
    fd.append("file", f);
    const { data, error } = await supabase.functions.invoke("upload-foto-atleta", { body: fd });
    if (error || (data as any)?.error) {
      toast.error("Caricamento non riuscito, riprova");
    } else {
      set_atleta((prec: any) => ({ ...prec, foto_url: (data as any).foto_url }));
      toast.success("Foto aggiornata");
    }
    set_uploading(false);
  };

  const on_save = async () => {
    if (!atleta?.id) return;
    set_saving(true);
    const sessione_ok = await portale_ensure_session();
    if (!sessione_ok) {
      toast.error("Sessione scaduta, reinserisci il codice atleta");
      set_saving(false);
      return;
    }
    const payload: Record<string, any> = {
      indirizzo: form.indirizzo || null,
      cap: form.cap || null,
      citta: form.citta || null,
      cantone: form.cantone || null,
      telefono: form.telefono || null,
    };
    if (usa_g2) {
      payload.genitore2_email = form.genitore_email || null;
      payload.genitore2_telefono = form.genitore_telefono || null;
    } else {
      payload.genitore1_email = form.genitore_email || null;
      payload.genitore1_telefono = form.genitore_telefono || null;
    }
    const { data, error } = await supabase
      .from("atleti").update(payload).eq("id", atleta.id).select("*").maybeSingle();
    if (error) {
      toast.error(error.message || "Salvataggio non riuscito");
    } else if (!data) {
      // PostgREST non restituisce errore se la policy RLS non fa match:
      // nessuna riga aggiornata => il salvataggio NON è avvenuto.
      toast.error("Salvataggio non riuscito, contatta l'amministratore");
    } else {
      set_atleta(data);
      applica_form(data);
      toast.success("Modifiche salvate");
    }
    set_saving(false);
  };


  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-sky-500" /></div>;
  }
  if (!atleta) return <p className="text-slate-500">Nessun dato disponibile.</p>;

  const data_nascita = atleta.data_nascita
    ? new Date(atleta.data_nascita + "T00:00:00").toLocaleDateString("it-CH", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const has_g1 = atleta.genitore1_nome || atleta.genitore1_email || atleta.genitore1_telefono;
  const has_g2 = atleta.genitore2_nome || atleta.genitore2_email || atleta.genitore2_telefono;
  const iniziali = `${atleta.nome?.[0] ?? ""}${atleta.cognome?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Anagrafica + modifica */}
        <SectionCard icon={IdCard} title="Anagrafica" gradient="from-sky-500 to-indigo-500">
          <div className="flex items-center gap-4 mb-5">
            <button
              type="button"
              onClick={() => input_file.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xl shadow-sm"
              aria-label="Cambia foto atleta"
            >
              {atleta.foto_url ? (
                <img src={atleta.foto_url} alt={`Foto di ${atleta.nome} ${atleta.cognome}`} className="w-full h-full object-cover" />
              ) : (
                <span>{iniziali || "?"}</span>
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              </span>
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-800">Foto atleta</p>
              <p className="text-xs text-slate-500">Tocca la foto per cambiarla (JPG o PNG, max 2MB)</p>
            </div>
            <input ref={input_file} type="file" accept="image/jpeg,image/png" className="hidden" onChange={on_file} />
          </div>

          <dl>
            <Row label="Data di nascita">{data_nascita}</Row>
            <Row label="Sesso">{atleta.sesso === "F" ? "Femmina" : atleta.sesso === "M" ? "Maschio" : "—"}</Row>
            <Row label="Codice atleta" mono>{atleta.codice_atleta ?? "—"}</Row>
            <Row label="Categoria"><span className="capitalize">{atleta.categoria ?? "—"}</span></Row>
            <Row label="Codice fiscale">{atleta.codice_fiscale || "—"}</Row>
          </dl>

          <div className="mt-5 space-y-3">
            <div>
              <Label htmlFor="indirizzo">Indirizzo</Label>
              <Input id="indirizzo" value={form.indirizzo} onChange={(e) => set_form((f) => ({ ...f, indirizzo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="cap">CAP</Label>
                <Input id="cap" value={form.cap} onChange={(e) => set_form((f) => ({ ...f, cap: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="citta">Città</Label>
                <Input id="citta" value={form.citta} onChange={(e) => set_form((f) => ({ ...f, citta: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cantone">Cantone</Label>
                <Input id="cantone" value={form.cantone} onChange={(e) => set_form((f) => ({ ...f, cantone: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="telefono">Telefono atleta</Label>
                <Input id="telefono" value={form.telefono} onChange={(e) => set_form((f) => ({ ...f, telefono: e.target.value }))} />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Stato tecnico (sola lettura) */}
        <SectionCard icon={Trophy} title="Stato tecnico" gradient="from-violet-500 to-purple-600">
          <div className="space-y-4">
            {atleta.agonista && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm">
                <Sparkles className="w-3 h-3" /> Agonista
              </span>
            )}

            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Livello attuale</p>
              <p className="text-2xl font-extrabold text-slate-800">
                {atleta.livello_amatori || atleta.livello_artistica || atleta.livello_stile || atleta.livello_attuale || "—"}
              </p>
              {(atleta.livello_in_preparazione || atleta.livello_artistica_in_preparazione || atleta.livello_stile_in_preparazione) && (
                <p className="text-sm text-violet-600 font-semibold mt-1">
                  In preparazione: {atleta.livello_in_preparazione || atleta.livello_artistica_in_preparazione || atleta.livello_stile_in_preparazione}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {atleta.livello_artistica && (
                <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
                  Artistica · {atleta.livello_artistica}
                </span>
              )}
              {atleta.livello_stile && (
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                  Stile · {atleta.livello_stile}
                </span>
              )}
              {atleta.livello_amatori && (
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold">
                  Amatori · {atleta.livello_amatori}
                </span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Contatti genitore modificabili */}
        <SectionCard icon={Mail} title="I miei contatti" gradient="from-amber-500 to-orange-600">
          <p className="text-xs text-slate-500 mb-3">
            Stai aggiornando i contatti di {usa_g2 ? "Genitore 2" : "Genitore 1"}.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="g_email">Email</Label>
              <Input id="g_email" type="email" value={form.genitore_email} onChange={(e) => set_form((f) => ({ ...f, genitore_email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="g_tel">Telefono</Label>
              <Input id="g_tel" value={form.genitore_telefono} onChange={(e) => set_form((f) => ({ ...f, genitore_telefono: e.target.value }))} />
            </div>
          </div>
        </SectionCard>

        {/* Genitori (sola lettura) */}
        <SectionCard icon={Users} title="Genitori" gradient="from-emerald-500 to-teal-600">
          {!has_g1 && !has_g2 ? (
            <p className="text-sm text-slate-500">Nessun genitore registrato.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {has_g1 && (
                <GenitoreCard
                  nome={atleta.genitore1_nome}
                  cognome={atleta.genitore1_cognome}
                  email={atleta.genitore1_email}
                  tel={atleta.genitore1_telefono}
                  indirizzo={atleta.genitore1_indirizzo}
                  cap={atleta.genitore1_cap}
                  citta={atleta.genitore1_citta}
                  cantone={atleta.genitore1_cantone}
                  idx={0}
                />
              )}
              {has_g2 && (
                <GenitoreCard
                  nome={atleta.genitore2_nome}
                  cognome={atleta.genitore2_cognome}
                  email={atleta.genitore2_email}
                  tel={atleta.genitore2_telefono}
                  indirizzo={atleta.genitore2_indirizzo}
                  cap={atleta.genitore2_cap}
                  citta={atleta.genitore2_citta}
                  cantone={atleta.genitore2_cantone}
                  idx={1}
                />
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={on_save} disabled={saving} className="h-12 px-6 rounded-2xl shadow-lg">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio…</> : <><Save className="w-4 h-4 mr-2" /> Salva modifiche</>}
        </Button>
      </div>
    </div>
  );
};

export default AtletaTab;
