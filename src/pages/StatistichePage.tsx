import React, { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { use_atleti, use_corsi, use_gare, use_lezioni_private, use_istruttori } from "@/hooks/use-supabase-data";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Trophy, Clock, AlertTriangle, Star } from "lucide-react";

const COLORS = ["#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

const Card = ({ title, icon, children }) => (
  <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
    </div>
    {children}
  </div>
);

const StatBox = ({ label, value, sub, color = "text-foreground" }) => (
  <div className="text-center p-3 bg-muted/20 rounded-lg">
    <p className={"text-2xl font-bold tabular-nums " + color}>{value}</p>
    <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

const StatistichePage = () => {
  const { session } = useAuth();
  const club_id = session?.club_id;

  const { data: atleti = [] } = use_atleti();
  const { data: corsi = [] } = use_corsi();
  const { data: gare = [] } = use_gare();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();

  const { data: presenze = [] } = useQuery({
    queryKey: ["presenze_stats", club_id],
    queryFn: async () => {
      if (!club_id) return [];
      const quattro_sett = new Date();
      quattro_sett.setDate(quattro_sett.getDate() - 28);
      const { data } = await supabase.from("presenze").select("*").eq("club_id", club_id).gte("data", quattro_sett.toISOString().split("T")[0]);
      return data ?? [];
    },
    enabled: !!club_id,
  });

  const atleti_attivi = atleti.filter((a) => a.stato === "attivo");
  const atleti_agonisti = atleti.filter((a) => a.carrieraArtistica || a.carrieraStile);
  const atleti_amatori = atleti_attivi.filter((a) => !a.carrieraArtistica && !a.carrieraStile);

  const livelli_data = useMemo(() => {
    const map = {};
    for (const a of atleti_attivi) {
      const lv = a.percorsoAmatori || "Non definito";
      map[lv] = (map[lv] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [atleti_attivi]);

  const corsi_per_giorno = useMemo(() => {
    const giorni = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    const giorni_full = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"];
    return giorni.map((g, i) => ({
      giorno: g,
      corsi: corsi.filter((c) => {
        const gdb = (c.giorno || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return gdb.startsWith(giorni_full[i].slice(0, 3)) && c.stato === "attivo";
      }).length,
    })).filter((g) => g.corsi > 0);
  }, [corsi]);

  const totale_iscrizioni = gare.reduce((s, g) => s + (g.atleti_iscritti?.length || 0), 0);
  const gare_con_risultati = gare.filter((g) => g.atleti_iscritti?.length > 0);
  const media_iscritti = gare_con_risultati.length > 0 ? (totale_iscrizioni / gare_con_risultati.length).toFixed(1) : "0";

  const medaglie = useMemo(() => {
    let oro = 0, argento = 0, bronzo = 0;
    for (const g of gare) {
      for (const i of g.atleti_iscritti || []) {
        if (i.medaglia === "oro") oro++;
        if (i.medaglia === "argento") argento++;
        if (i.medaglia === "bronzo") bronzo++;
      }
    }
    return { oro, argento, bronzo };
  }, [gare]);

  const atleti_con_presenze = new Set(presenze.map((p) => p.persona_id)).size;
  const tasso_presenze = atleti_attivi.length > 0 ? Math.round((atleti_con_presenze / atleti_attivi.length) * 100) : 0;

  const lezioni_per_istruttore = useMemo(() => {
    return istruttori.filter((i) => i.stato === "attivo")
      .map((i) => ({ nome: i.nome, lezioni: lezioni.filter((l) => l.istruttore_id === i.id).length }))
      .filter((i) => i.lezioni > 0).sort((a, b) => b.lezioni - a.lezioni).slice(0, 5);
  }, [istruttori, lezioni]);

  const due_sett = new Date();
  due_sett.setDate(due_sett.getDate() - 14);
  const presenze_recenti = new Set(presenze.filter((p) => p.data >= due_sett.toISOString().split("T")[0]).map((p) => p.persona_id));
  const atleti_assenti = atleti_attivi.filter((a) => !presenze_recenti.has(a.id)).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Statistiche Tecniche</h1>
          <p className="text-sm text-muted-foreground">Panoramica performance e partecipazione del club</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Atleti attivi" value={atleti_attivi.length} />
        <StatBox label="Agonisti" value={atleti_agonisti.length} sub={atleti_amatori.length + " amatori"} color="text-primary" />
        <StatBox label="Presenze 4 sett." value={tasso_presenze + "%"} sub={atleti_con_presenze + " atleti"} color={tasso_presenze >= 70 ? "text-success" : "text-orange-500"} />
        <StatBox label="Lezioni private" value={lezioni.length} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Distribuzione per livello" icon={<Users className="w-4 h-4" />}>
          {livelli_data.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={livelli_data} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => name + ": " + value} labelLine={false}>
                  {livelli_data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Nessun dato</p>}
        </Card>
        <Card title="Corsi per giorno" icon={<Clock className="w-4 h-4" />}>
          {corsi_per_giorno.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={corsi_per_giorno}>
                <XAxis dataKey="giorno" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="corsi" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Nessun corso attivo</p>}
        </Card>
        <Card title="Gare e risultati" icon={<Trophy className="w-4 h-4" />}>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <StatBox label="Gare totali" value={gare.length} />
            <StatBox label="Media iscritti" value={media_iscritti} />
            <StatBox label="Iscrizioni tot." value={totale_iscrizioni} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 text-center p-2 rounded-lg" style={{background:"#fef9c3"}}>
              <p className="text-xl font-bold" style={{color:"#a16207"}}>{medaglie.oro}</p>
              <p className="text-xs" style={{color:"#a16207"}}>Oro</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-lg" style={{background:"#f3f4f6"}}>
              <p className="text-xl font-bold" style={{color:"#4b5563"}}>{medaglie.argento}</p>
              <p className="text-xs" style={{color:"#4b5563"}}>Argento</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-lg" style={{background:"#fff7ed"}}>
              <p className="text-xl font-bold" style={{color:"#c2410c"}}>{medaglie.bronzo}</p>
              <p className="text-xs" style={{color:"#c2410c"}}>Bronzo</p>
            </div>
          </div>
        </Card>
        <Card title="Lezioni private per istruttore" icon={<Star className="w-4 h-4" />}>
          {lezioni_per_istruttore.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={lezioni_per_istruttore} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 12 }} width={70} />
                <Tooltip />
                <Bar dataKey="lezioni" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Nessuna lezione</p>}
        </Card>
      </div>
      {atleti_assenti.length > 0 && (
        <Card title="Atleti assenti da 2+ settimane" icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}>
          <div className="space-y-2">
            {atleti_assenti.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{background:"#fff7ed"}}>
                <p className="text-sm font-medium text-foreground">{a.nome} {a.cognome}</p>
                <span className="text-xs font-medium" style={{color:"#c2410c"}}>Assente</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default StatistichePage;