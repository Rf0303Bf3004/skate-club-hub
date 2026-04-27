import { useState } from "react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { X, Copy, Check, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Props {
  atleta: any;
  genitore_email: string;
  genitore_nome: string;
  on_close: () => void;
}

function genera_token(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function InvitoGenitoreModal({ atleta, genitore_email, genitore_nome, on_close }: Props) {
  const [loading, set_loading] = useState(false);
  const [token, set_token] = useState<string | null>(null);
  const [scadenza, set_scadenza] = useState("");
  const [copied, set_copied] = useState(false);

  const genera_invito = async () => {
    set_loading(true);
    try {
      const nuovo_token = genera_token();
      const scadenza_display = "Nessuna scadenza";
      const far_future = new Date("2099-12-31T23:59:59Z");
      const { error } = await supabase.from("inviti_genitori").insert({
        atleta_id: atleta.id,
        club_id: get_current_club_id(),
        email: genitore_email,
        token: nuovo_token,
        expires_at: far_future.toISOString(),
        usato: false,
      });
      if (error) throw error;
      set_token(nuovo_token);
      set_scadenza(scadenza_display);
      toast({ title: "✅ Codice invito generato" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      set_loading(false);
    }
  };

  const copia_codice = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    set_copied(true);
    setTimeout(() => set_copied(false), 2000);
  };

  const stampa_pdf = () => {
    if (!token) return;
    const livello = atleta.carriera_artistica || atleta.carriera_stile || atleta.percorso_amatori || "—";
    const deep_link = `icearena://login?token=${token}`;
    const qr_url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(deep_link)}&color=0284C7&bgcolor=F0F9FF`;
    const data_nascita = atleta.data_nascita ? new Date(atleta.data_nascita + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" }) : "—";
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Invito Ice Arena</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;}
.header{background:linear-gradient(135deg,#0284C7,#0369A1,#1E3A5F);color:white;padding:28px 32px;}
.header-inner{display:flex;align-items:center;gap:16px;}
.header-icon{font-size:40px;}
.header-title{font-size:26px;font-weight:900;}
.header-sub{font-size:13px;color:rgba(255,255,255,0.65);margin-top:2px;}
.body{padding:28px 32px;}
.section-title{background:#0284C7;color:white;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:6px 14px;border-radius:6px;margin-bottom:14px;display:inline-block;}
.atleta-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:18px;display:flex;align-items:center;gap:16px;margin-bottom:24px;}
.atleta-avatar{width:54px;height:54px;border-radius:50%;background:#0EA5E9;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;flex-shrink:0;}
.atleta-nome{font-size:18px;font-weight:800;color:#0F172A;}
.atleta-info{font-size:12px;color:#64748B;margin-top:3px;}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-top:6px;}
.badge-blue{background:#0EA5E9;color:white;}
.invito-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;}
.qr-box{background:#F0F9FF;border:1.5px solid #BAE6FD;border-radius:14px;padding:18px;text-align:center;}
.qr-title{font-size:11px;font-weight:800;color:#0284C7;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;}
.qr-img{width:140px;height:140px;}
.qr-sub{font-size:10px;color:#0369A1;margin-top:8px;}
.codice-box{background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:14px;padding:18px;}
.codice-title{font-size:11px;font-weight:800;color:#EA580C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
.codice-desc{font-size:11px;color:#7C2D12;margin-bottom:12px;line-height:1.5;}
.codice-value{background:#FFEDD5;border:1.5px solid #FB923C;border-radius:10px;padding:12px;text-align:center;font-size:16px;font-weight:900;color:#9A3412;letter-spacing:2px;margin-bottom:10px;}
.codice-scadenza{font-size:11px;color:#7C2D12;text-align:center;margin-bottom:14px;}
.istruzioni{list-style:none;}
.istruzioni li{font-size:11px;color:#431407;padding:3px 0;}
.istruzioni li::before{content:"→ ";color:#EA580C;font-weight:700;}
.features-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:16px;margin-bottom:20px;}
.features-title{font-size:11px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;}
.features-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.feature{text-align:center;}
.feature-emoji{font-size:22px;}
.feature-name{font-size:10px;font-weight:700;color:#0F172A;margin-top:4px;}
.feature-desc{font-size:9px;color:#64748B;margin-top:2px;}
.footer{border-top:1px solid #E2E8F0;padding-top:14px;text-align:center;color:#94A3B8;font-size:9px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:0;size:A4;}}
</style></head><body>
<div class="header">
  <div class="header-inner">
    <div class="header-icon">⛸️</div>
    <div>
      <div class="header-title">Ice Arena</div>
      <div class="header-sub">Portale Genitori — Invito di accesso</div>
    </div>
  </div>
</div>
<div class="body">
  <div class="section-title">Dati Atleta</div>
  <div class="atleta-card">
    <div class="atleta-avatar">${atleta.nome?.[0]}${atleta.cognome?.[0]}</div>
    <div>
      <div class="atleta-nome">${atleta.nome} ${atleta.cognome}</div>
      <div class="atleta-info">Data di nascita: ${data_nascita}${atleta.tag_nfc ? " · NFC: " + atleta.tag_nfc : ""}</div>
      <div class="badge badge-blue">★ ${livello}</div>
    </div>
  </div>
  <div class="section-title">Accesso all'App</div>
  <div class="invito-grid">
    <div class="qr-box">
      <div class="qr-title">Scansiona per accedere</div>
      <img class="qr-img" src="${qr_url}" alt="QR Code" />
      <div class="qr-sub">Apre direttamente l'app Ice Arena</div>
    </div>
    <div class="codice-box">
      <div class="codice-title">Codice Invito Manuale</div>
      <div class="codice-desc">Se il QR non funziona, inserisci questo codice nell'app:</div>
      <div class="codice-value">${token.slice(0, 8)}-${token.slice(8)}</div>
      <div class="codice-scadenza">✅ Codice senza scadenza</div>
      <ul class="istruzioni">
        <li>Scarica "Ice Arena" dall'App Store</li>
        <li>Tocca "Codice Invito"</li>
        <li>Inserisci il codice qui sopra</li>
        <li>Accedi al profilo di tuo figlio/a</li>
      </ul>
    </div>
  </div>
  <div class="features-box">
    <div class="features-title">Cosa puoi fare con l'app</div>
    <div class="features-grid">
      <div class="feature"><div class="feature-emoji">👤</div><div class="feature-name">Profilo Atleta</div><div class="feature-desc">Dati e stato tecnico</div></div>
      <div class="feature"><div class="feature-emoji">🏆</div><div class="feature-name">Gare</div><div class="feature-desc">Risultati e medaglie</div></div>
      <div class="feature"><div class="feature-emoji">📅</div><div class="feature-name">Lezioni</div><div class="feature-desc">Calendario lezioni private</div></div>
      <div class="feature"><div class="feature-emoji">💳</div><div class="feature-name">Fatture</div><div class="feature-desc">Pagamenti e storico</div></div>
    </div>
  </div>
  <div class="footer">Ice Arena Manager · Documento riservato al destinatario · Codice senza scadenza</div>
</div>
</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-primary-foreground font-bold text-lg">Genera Invito App</h2>
            <p className="text-primary-foreground/70 text-xs mt-0.5">
              {atleta.nome} {atleta.cognome} → {genitore_nome || genitore_email}
            </p>
          </div>
          <button onClick={on_close} className="text-primary-foreground/80 hover:text-primary-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!token ? (
            <>
              <div className="bg-muted rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-foreground mb-1">Come funziona</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Verrà generato un codice invito permanente (senza scadenza). Il genitore lo inserirà nell'app Ice Arena per accedere al profilo di {atleta.nome}.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3 mb-5 border">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {genitore_nome?.[0] || genitore_email?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{genitore_nome}</p>
                  <p className="text-xs text-muted-foreground">{genitore_email}</p>
                </div>
              </div>

              <Button onClick={genera_invito} disabled={loading} className="w-full" size="lg">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generazione...</> : "🔑 Genera Codice Invito"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2 mb-4">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Codice generato e salvato</span>
              </div>

              <div className="text-center mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Codice Invito</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black tracking-[3px] text-foreground">
                    {token.slice(0, 8)}-{token.slice(8)}
                  </span>
                  <button onClick={copia_codice} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Codice permanente — nessuna scadenza</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={on_close} className="flex-1">
                  Chiudi
                </Button>
                <Button onClick={stampa_pdf} className="flex-1">
                  <Printer className="w-4 h-4" /> Stampa PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}