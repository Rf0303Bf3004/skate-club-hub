import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import type { PortaleSession } from "@/lib/portale-auth";
import { Badge } from "@/components/ui/badge";

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between items-baseline border-b border-slate-100 py-2 last:border-0">
    <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className="text-sm font-medium text-slate-800 text-right">{children}</dd>
  </div>
);

const AtletaTab: React.FC = () => {
  // Cerca session nel contesto del layout principale (PortaleLayout)
  const ctx = useOutletContext<{ session?: PortaleSession }>() as any;
  const [atleta, set_atleta] = useState<any | null>(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    (async () => {
      const session = ctx?.session as PortaleSession | undefined;
      const id = session?.atleta?.id;
      if (!id) { set_loading(false); return; }
      const { data } = await supabase.from("atleti").select("*").eq("id", id).maybeSingle();
      set_atleta(data);
      set_loading(false);
    })();
  }, [ctx]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>;
  }
  if (!atleta) return <p className="text-slate-500">Nessun dato</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="font-bold text-slate-800 mb-3">Anagrafica</h2>
        <dl>
          <Row label="Nome">{atleta.nome} {atleta.cognome}</Row>
          <Row label="Data di nascita">{atleta.data_nascita ? new Date(atleta.data_nascita + "T00:00:00").toLocaleDateString("it-CH") : "—"}</Row>
          <Row label="Indirizzo">{atleta.indirizzo || "—"}</Row>
          <Row label="Telefono">{atleta.telefono || "—"}</Row>
        </dl>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="font-bold text-slate-800 mb-3">Livello tecnico</h2>
        <div className="flex flex-wrap gap-2">
          {atleta.percorso_amatori && <Badge variant="outline">Amatori: {atleta.percorso_amatori}</Badge>}
          {atleta.carriera_artistica && <Badge variant="outline">Artistica: {atleta.carriera_artistica}</Badge>}
          {atleta.carriera_stile && <Badge variant="outline">Stile: {atleta.carriera_stile}</Badge>}
          {!atleta.percorso_amatori && !atleta.carriera_artistica && !atleta.carriera_stile && (
            <span className="text-sm text-slate-500">Nessun livello assegnato</span>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="font-bold text-slate-800 mb-3">Genitori</h2>
        <dl>
          <Row label="Genitore 1">{atleta.genitore1_nome || atleta.genitore1_email || "—"}</Row>
          <Row label="Genitore 2">{atleta.genitore2_nome || atleta.genitore2_email || "—"}</Row>
        </dl>
      </div>
    </div>
  );
};

export default AtletaTab;
