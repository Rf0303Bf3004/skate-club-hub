import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Save, X, RefreshCw, Copy, Eye, EyeOff, Upload, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AnagraficaTerritoriale } from "@/components/AnagraficaTerritoriale";
import {
  isValidPartitaIVA,
  isValidIBAN,
  getPartitaIVAPlaceholder,
  getIBANPlaceholder,
  getTelefonoPlaceholder,
  type paese_iso,
} from "@/lib/territori";

function gen_password(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

const SuperAdminNewClubPage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [saving, set_saving] = useState(false);
  const [show_pwd, set_show_pwd] = useState(false);
  const [uploading_logo, set_uploading_logo] = useState(false);

  // Sezione A
  const [nome_club, set_nome_club] = useState("");
  const [sigla, set_sigla] = useState("");
  const [indirizzo, set_indirizzo] = useState("");
  const [cap, set_cap] = useState("");
  const [citta, set_citta] = useState("");
  const [cantone, set_cantone] = useState("");
  const [regione, set_regione] = useState<string | null>(null);
  const [provincia, set_provincia] = useState<string | null>(null);
  const [codice_fiscale, set_codice_fiscale] = useState("");
  const [paese_code, set_paese_code] = useState<paese_iso>("CH");
  const [email_club, set_email_club] = useState("");
  const [telefono_club, set_telefono_club] = useState("");
  const [sito_web, set_sito_web] = useState("");
  const [numero_tessera, set_numero_tessera] = useState("");
  const [partita_iva, set_partita_iva] = useState("");
  const [numero_iva_chf, set_numero_iva_chf] = useState("");
  const [iban, set_iban] = useState("");
  const [intestatario_iban, set_intestatario_iban] = useState("");
  const [logo_url, set_logo_url] = useState("");
  const [colore, set_colore] = useState("#3B82F6");

  // Sezione B (defaults precompilati)
  const [fee, set_fee] = useState(50);
  const [mesi_fee, set_mesi_fee] = useState(12);
  const [prezzo_atleta, set_prezzo_atleta] = useState(1.20);
  const [mesi_atleti, set_mesi_atleti] = useState(12);
  const [costo_setup, set_costo_setup] = useState(0);
  const [setup_fatturato, set_setup_fatturato] = useState(false);

  // Sezione C
  const [email_presidente, set_email_presidente] = useState("");
  const [nome_pres, set_nome_pres] = useState("");
  const [cognome_pres, set_cognome_pres] = useState("");
  const [telefono_pres, set_telefono_pres] = useState("");
  const [password, set_password] = useState(gen_password());

  if (session?.ruolo !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-muted-foreground mt-2">Accesso negato.</p>
        </div>
      </div>
    );
  }

  const handle_logo = async (file: File) => {
    set_uploading_logo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `nuovo-club-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("loghi-club").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("loghi-club").getPublicUrl(path);
      set_logo_url(data.publicUrl);
      toast({ title: "Logo caricato" });
    } catch (e: any) {
      toast({ title: "Errore upload logo", description: e.message, variant: "destructive" });
    } finally {
      set_uploading_logo(false);
    }
  };

  const handle_save = async () => {
    if (!nome_club.trim()) return toast({ title: "Nome club obbligatorio", variant: "destructive" });
    if (!email_presidente.trim() || !nome_pres.trim() || !cognome_pres.trim()) {
      return toast({ title: "Dati presidente obbligatori", variant: "destructive" });
    }
    if (password.length < 8) return toast({ title: "Password minimo 8 caratteri", variant: "destructive" });

    set_saving(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-club", {
        body: {
          nome_club: nome_club.trim(),
          sigla: sigla.trim() || undefined,
          indirizzo: indirizzo.trim() || undefined,
          cap: cap.trim() || undefined,
          citta: citta.trim() || undefined,
          cantone: cantone || undefined,
          paese: paese.trim() || undefined,
          email_club: email_club.trim() || undefined,
          telefono_club: telefono_club.trim() || undefined,
          sito_web: sito_web.trim() || undefined,
          numero_tessera_federale: numero_tessera.trim() || undefined,
          partita_iva: partita_iva.trim() || undefined,
          numero_iva_chf: numero_iva_chf.trim() || undefined,
          iban: iban.trim() || undefined,
          intestatario_iban: intestatario_iban.trim() || undefined,
          logo_url: logo_url.trim() || undefined,
          colore_primario: colore,
          fee_fissa_chf: fee,
          prezzo_per_atleta_chf: prezzo_atleta,
          costo_setup_chf: costo_setup,
          setup_fatturato,
          mesi_fatturazione_fee: mesi_fee,
          mesi_fatturazione_atleti: mesi_atleti,
          email_presidente: email_presidente.trim(),
          password,
          nome_presidente: nome_pres.trim(),
          cognome_presidente: cognome_pres.trim(),
          telefono: telefono_pres.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Club creato",
        description: `Credenziali presidente: ${email_presidente} / ${password}`,
      });
      navigate(`/superadmin/clubs/${data.club_id}`);
    } catch (e: any) {
      toast({ title: "Errore creazione club", description: e.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nuovo club</h1>
            <p className="text-sm text-muted-foreground">Crea manualmente un nuovo club e l'utente presidente.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> Annulla
          </Button>
          <Button onClick={handle_save} disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Salva e crea club
          </Button>
        </div>
      </div>

      {/* Sezione A */}
      <Card>
        <CardHeader><CardTitle>A. Anagrafica club</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Nome ufficiale *</label>
            <Input value={nome_club} onChange={(e) => set_nome_club(e.target.value)} placeholder="Stella del Ghiaccio ASD" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sigla</label>
            <Input value={sigla} onChange={(e) => set_sigla(e.target.value)} maxLength={10} placeholder="SDG" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Numero tessera federale</label>
            <Input value={numero_tessera} onChange={(e) => set_numero_tessera(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Indirizzo</label>
            <Input value={indirizzo} onChange={(e) => set_indirizzo(e.target.value)} placeholder="Via Roma 1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">CAP</label>
            <Input value={cap} onChange={(e) => set_cap(e.target.value)} maxLength={4} placeholder="6900" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Città</label>
            <Input value={citta} onChange={(e) => set_citta(e.target.value)} placeholder="Lugano" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cantone</label>
            <select value={cantone} onChange={(e) => set_cantone(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {CANTONI.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Paese</label>
            <Input value={paese} onChange={(e) => set_paese(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email del club</label>
            <Input type="email" value={email_club} onChange={(e) => set_email_club(e.target.value)} placeholder="info@club.ch" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Telefono</label>
            <Input value={telefono_club} onChange={(e) => set_telefono_club(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Sito web</label>
            <Input value={sito_web} onChange={(e) => set_sito_web(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Partita IVA</label>
            <Input value={partita_iva} onChange={(e) => set_partita_iva(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Numero IVA CH (CHE-XXX.XXX.XXX)</label>
            <Input value={numero_iva_chf} onChange={(e) => set_numero_iva_chf(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">IBAN</label>
            <Input value={iban} onChange={(e) => set_iban(e.target.value)} placeholder="CH..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Intestatario IBAN</label>
            <Input value={intestatario_iban} onChange={(e) => set_intestatario_iban(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Logo</label>
            <div className="flex items-center gap-2">
              {logo_url && <img src={logo_url} alt="" className="w-10 h-10 rounded border object-cover" />}
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm hover:bg-muted">
                <Upload className="w-4 h-4" />
                {uploading_logo ? "Caricamento..." : "Carica"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handle_logo(e.target.files[0])} />
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Colore primario</label>
            <input type="color" value={colore} onChange={(e) => set_colore(e.target.value)} className="block w-16 h-10 rounded border cursor-pointer" />
          </div>
        </CardContent>
      </Card>

      {/* Sezione B */}
      <Card>
        <CardHeader><CardTitle>B. Tariffazione iniziale</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Canone base mensile CHF</label>
            <Input type="number" step="0.01" value={fee} onChange={(e) => set_fee(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Mesi fatturazione canone</label>
            <Input type="number" min={0} max={12} value={mesi_fee} onChange={(e) => set_mesi_fee(Number(e.target.value))} />
          </div>
          <div />
          <div>
            <label className="text-xs text-muted-foreground">Prezzo per atleta/mese CHF</label>
            <Input type="number" step="0.01" value={prezzo_atleta} onChange={(e) => set_prezzo_atleta(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Mesi fatturazione atleti</label>
            <Input type="number" min={0} max={12} value={mesi_atleti} onChange={(e) => set_mesi_atleti(Number(e.target.value))} />
          </div>
          <div />
          <div>
            <label className="text-xs text-muted-foreground">Costo setup CHF</label>
            <Input type="number" step="0.01" value={costo_setup} onChange={(e) => set_costo_setup(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2">
            <input type="checkbox" id="setup_fatt" checked={setup_fatturato} onChange={(e) => set_setup_fatturato(e.target.checked)} />
            <label htmlFor="setup_fatt" className="text-sm">Setup già fatturato</label>
          </div>
        </CardContent>
      </Card>

      {/* Sezione C */}
      <Card>
        <CardHeader><CardTitle>C. Primo utente presidente</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Email presidente *</label>
            <Input type="email" value={email_presidente} onChange={(e) => set_email_presidente(e.target.value)} placeholder="presidente@club.ch" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nome *</label>
            <Input value={nome_pres} onChange={(e) => set_nome_pres(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cognome *</label>
            <Input value={cognome_pres} onChange={(e) => set_cognome_pres(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Telefono</label>
            <Input value={telefono_pres} onChange={(e) => set_telefono_pres(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Password temporanea *</label>
            <div className="flex gap-2">
              <Input type={show_pwd ? "text" : "password"} value={password} onChange={(e) => set_password(e.target.value)} />
              <Button type="button" variant="outline" size="icon" onClick={() => set_show_pwd((v) => !v)}>
                {show_pwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(password); toast({ title: "Copiata" }); }}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => set_password(gen_password())}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Verrà comunicata al presidente per il primo login.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>Annulla</Button>
        <Button onClick={handle_save} disabled={saving}>
          {saving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salva e crea club
        </Button>
      </div>
    </div>
  );
};

export default SuperAdminNewClubPage;
