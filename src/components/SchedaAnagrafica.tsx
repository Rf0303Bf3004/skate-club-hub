import React from "react";
import { use_club } from "@/hooks/use-supabase-data";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

interface SchedaProps { atleta: any; on_back: () => void; }

const Fld = ({ label, value, blue }: { label: string; value?: string | null; blue?: boolean }) => (
  <div className={blue ? "bg-blue-50 border border-blue-100 rounded-lg px-3 py-2" : "bg-gray-50 rounded-lg px-3 py-2"}>
    <p className={blue ? "text-xs text-blue-400" : "text-xs text-gray-400"}>{label}</p>
    <p className={blue ? "text-sm font-medium text-blue-800" : "text-sm font-medium text-gray-800"}>{value || "—"}</p>
  </div>
);

const SchedaAnagrafica: React.FC<SchedaProps> = ({ atleta, on_back }) => {
  const { data: club } = use_club();
  const codice = ((atleta.cognome || "") + (atleta.nome || "") + "0001").toUpperCase().replace(/\s/g, "").slice(0, 16);
  const qr_url = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" + encodeURIComponent(codice) + "&color=1a1a2e&bgcolor=ffffff&qzone=1";
  const iniziali = (atleta.nome?.[0] || "") + (atleta.cognome?.[0] || "");
  const ha_licenza = !!(atleta.carriera_artistica || atleta.carriera_stile) && !!atleta.licenza_sis_numero;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={on_back}><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>
        <span className="text-sm text-muted-foreground flex-1">{atleta.nome} {atleta.cognome}</span>
        <Button size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Stampa / PDF</Button>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 max-w-2xl mx-auto">
        <div style={{background:"#1a1a2e"}} className="px-6 py-4 flex items-center gap-4">
          <div style={{background:"#818cf8"}} className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">C</div>
          <div>
            <p className="text-white font-semibold text-base">{club?.nome || "Club"}</p>
            <p style={{color:"rgba(255,255,255,0.5)"}} className="text-xs">Scheda anagrafica atleta</p>
          </div>
          <span style={{background:"rgba(129,140,248,0.2)",color:"#818cf8"}} className="ml-auto text-xs font-bold px-3 py-1 rounded-full uppercase">{atleta.stato === "attivo" ? "Attivo" : "Inattivo"}</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="col-span-2 p-6 space-y-4">
            <div className="flex items-center gap-4">
              {atleta.foto_url ? <img src={atleta.foto_url} className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100" /> : <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl shrink-0">{iniziali}</div>}
              <div>
                <p className="text-xl font-semibold text-gray-900">{atleta.nome} {atleta.cognome}</p>
                <p className="text-sm text-gray-500 mt-0.5">Nato/a il {atleta.data_nascita ? new Date(atleta.data_nascita).toLocaleDateString("it-IT") : "—"}</p>
                <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{atleta.percorso_amatori || atleta.carriera_artistica || "—"}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Dati personali</p>
              <div className="grid grid-cols-2 gap-2">
                <Fld label="Codice fiscale" value={atleta.codice_fiscale} />
                <Fld label="Luogo di nascita" value={atleta.luogo_nascita} />
                <Fld label="Indirizzo" value={atleta.indirizzo} />
                <Fld label="Telefono" value={atleta.telefono} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Genitore / Tutore</p>
              <div className="grid grid-cols-2 gap-2">
                <Fld label="Nome" value={atleta.genitore1_nome ? atleta.genitore1_nome + " " + (atleta.genitore1_cognome || "") : null} />
                <Fld label="Email" value={atleta.genitore1_email} />
                <Fld label="Telefono" value={atleta.genitore1_telefono} />
              </div>
            </div>
            {ha_licenza && (<div>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Licenza Swiss Ice Skating</p>
              <div className="grid grid-cols-2 gap-2">
                <Fld label="N. Licenza" value={atleta.licenza_sis_numero} blue />
                <Fld label="Categoria" value={atleta.licenza_sis_categoria} blue />
                <Fld label="Disciplina" value={atleta.licenza_sis_disciplina} blue />
                <Fld label="Valida fino al" value={atleta.licenza_sis_validita_a ? new Date(atleta.licenza_sis_validita_a).toLocaleDateString("it-IT") : null} blue />
              </div>
            </div>)}
            {atleta.tag_nfc && (<div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0 text-green-700 font-bold text-xs">NFC</div>
              <div><p className="text-xs text-green-600 font-medium">Tag NFC</p><p className="text-sm font-bold text-green-800 font-mono">{atleta.tag_nfc}</p></div>
            </div>)}
          </div>
          <div className="p-5 flex flex-col items-center gap-4">
            <div className="text-center w-full">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">App Ice Arena</p>
              <img src={qr_url} alt="QR" className="w-32 h-32 rounded-xl border border-gray-200 mx-auto" />
              <p className="text-xs text-gray-500 mt-2">Scansiona per scaricare</p>
              <p className="text-xs font-bold mt-1 font-mono" style={{color:"#4f46e5"}}>{codice}</p>
              <p className="text-xs font-medium mt-0.5" style={{color:"#16a34a"}}>Non scade mai</p>
            </div>
            <div className="w-full border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-2">Foto profilo</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                <p className="text-xs text-amber-700 leading-relaxed">Sfondo bianco<br/>Busto e viso<br/>JPG o PNG<br/>Min 300x300 px<br/>Max 2 MB</p>
              </div>
            </div>
            <div className="w-full border-t border-gray-100 pt-3 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Istruzioni app</p>
              <p className="text-xs text-gray-500 leading-relaxed">1. Scarica Ice Arena<br/>2. Tocca Accedi<br/>3. Inserisci il codice<br/>4. Carica foto profilo</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <p className="text-xs text-gray-400">Tessera valida · Stagione 2025/26</p>
          <p className="text-xs text-gray-400">CPA Manager · {new Date().toLocaleDateString("it-IT")}</p>
        </div>
      </div>
    </div>
  );
};

export default SchedaAnagrafica;