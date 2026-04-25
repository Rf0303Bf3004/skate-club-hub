import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_atleti, use_stagioni, use_corsi, use_gare } from "@/hooks/use-supabase-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, BookOpen, FileText, Award } from "lucide-react";

const fmt_date = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("it-CH");
};

const PostSeasonPage = () => {
  const club_id = get_current_club_id();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti = [] } = use_atleti();
  const { data: gare = [] } = use_gare();
  const { data: corsi = [] } = use_corsi();
  const stagione_attiva = (stagioni as any[]).find((s) => s.attiva) ?? stagioni[0];
  const [stagione_id, setStagioneId] = useState<string>("");
  const sid = stagione_id || stagione_attiva?.id || "";

  const { data: medaglie = [] } = useQuery({
    queryKey: ["postseason_iscr", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase.from("iscrizioni_gare").select("*, gare_calendario(stagione_id, club_id)");
      return (data ?? []) as any[];
    },
  });

  const stats = useMemo(() => {
    const gare_stagione = (gare as any[]).filter((g) => g.stagione_id === sid);
    const corsi_stagione = (corsi as any[]).filter((c) => c.stagione_id === sid);
    const medaglie_stagione = medaglie.filter((m: any) => m.gare_calendario?.stagione_id === sid && m.gare_calendario?.club_id === club_id);
    const oro = medaglie_stagione.filter((m: any) => m.medaglia === "oro" || m.posizione === 1).length;
    const argento = medaglie_stagione.filter((m: any) => m.medaglia === "argento" || m.posizione === 2).length;
    const bronzo = medaglie_stagione.filter((m: any) => m.medaglia === "bronzo" || m.posizione === 3).length;
    return { atleti: atleti.length, gare: gare_stagione.length, corsi: corsi_stagione.length, oro, argento, bronzo };
  }, [gare, corsi, medaglie, atleti, sid, club_id]);

  const generaReportClub = () => {
    const stag = (stagioni as any[]).find((s) => s.id === sid);
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report Fine Stagione</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#1E2761}h1{color:#1E2761;border-bottom:3px solid #0077B6;padding-bottom:10px}h2{color:#0077B6;margin-top:30px}.kpi{display:inline-block;padding:20px;margin:10px;border:2px solid #0077B6;border-radius:8px;min-width:140px;text-align:center}.kpi .num{font-size:32px;font-weight:bold;color:#1E2761}.kpi .lbl{font-size:12px;color:#666;text-transform:uppercase}</style></head>
<body>
<h1>Report Fine Stagione — ${stag?.nome ?? "—"}</h1>
<p>Periodo: ${fmt_date(stag?.data_inizio)} → ${fmt_date(stag?.data_fine)}</p>
<h2>KPI Generali</h2>
<div class="kpi"><div class="num">${stats.atleti}</div><div class="lbl">Atleti</div></div>
<div class="kpi"><div class="num">${stats.corsi}</div><div class="lbl">Corsi</div></div>
<div class="kpi"><div class="num">${stats.gare}</div><div class="lbl">Gare</div></div>
<h2>Medagliere</h2>
<div class="kpi"><div class="num">🥇 ${stats.oro}</div><div class="lbl">Oro</div></div>
<div class="kpi"><div class="num">🥈 ${stats.argento}</div><div class="lbl">Argento</div></div>
<div class="kpi"><div class="num">🥉 ${stats.bronzo}</div><div class="lbl">Bronzo</div></div>
<p style="margin-top:40px;font-size:11px;color:#999">Generato il ${new Date().toLocaleDateString("it-CH")}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  const generaReportAtleta = (atleta: any) => {
    const med_atleta = medaglie.filter((m: any) => m.atleta_id === atleta.id && m.gare_calendario?.stagione_id === sid);
    const stag = (stagioni as any[]).find((s) => s.id === sid);
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report ${atleta.nome} ${atleta.cognome}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#1E2761}h1{color:#1E2761;border-bottom:3px solid #0077B6;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}</style></head>
<body>
<h1>Report Stagionale</h1>
<h2>${atleta.cognome} ${atleta.nome}</h2>
<p>Stagione: ${stag?.nome ?? "—"}</p>
<p>Livello: ${atleta.carriera_artistica || atleta.carriera_stile || atleta.percorso_amatori || "—"}</p>
<p>Ore pista: ${atleta.ore_pista_stagione ?? 0}</p>
<h3>Gare disputate (${med_atleta.length})</h3>
${med_atleta.length === 0 ? "<p>Nessuna gara</p>" : `<table><thead><tr><th>Gara</th><th>Posizione</th><th>Medaglia</th></tr></thead><tbody>
${med_atleta.map((m: any) => `<tr><td>${(gare as any[]).find((g) => g.id === m.gara_id)?.nome ?? "—"}</td><td>${m.posizione ?? "—"}</td><td>${m.medaglia ?? "—"}</td></tr>`).join("")}
</tbody></table>`}
<p style="margin-top:40px;font-size:11px;color:#999">Generato il ${new Date().toLocaleDateString("it-CH")}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Award className="w-8 h-8" /> Post Season
        </h1>
        <p className="text-muted-foreground mt-1">
          Report di fine stagione: KPI club, medagliere e schede individuali per atleta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Fine Stagione</CardTitle>
          <CardDescription>Genera report club generali e schede individuali per atleta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Stagione:</Label>
            <Select value={sid} onValueChange={setStagioneId}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(stagioni as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4 text-center"><Users className="w-5 h-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{stats.atleti}</p><p className="text-xs text-muted-foreground">Atleti</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><BookOpen className="w-5 h-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{stats.corsi}</p><p className="text-xs text-muted-foreground">Corsi</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><Trophy className="w-5 h-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{stats.gare}</p><p className="text-xs text-muted-foreground">Gare</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl">🥇</p><p className="text-2xl font-bold">{stats.oro}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl">🥈</p><p className="text-2xl font-bold">{stats.argento}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl">🥉</p><p className="text-2xl font-bold">{stats.bronzo}</p></CardContent></Card>
          </div>

          <Button onClick={generaReportClub}><FileText className="w-4 h-4 mr-2" /> Genera Report Club (PDF)</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report individuali</CardTitle>
          <CardDescription>Genera una scheda PDF per ciascun atleta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {(atleti as any[]).map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                <span className="text-sm">{a.cognome} {a.nome}</span>
                <Button size="sm" variant="outline" onClick={() => generaReportAtleta(a)}>
                  <FileText className="w-3 h-3 mr-1" /> PDF
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PostSeasonPage;
