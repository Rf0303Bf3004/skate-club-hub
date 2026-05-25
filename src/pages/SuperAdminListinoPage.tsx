import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type ClubRow = {
  id: string;
  nome: string;
  fee_fissa_chf: number;
  prezzo_per_atleta_chf: number;
  costo_setup_chf: number;
  setup_fatturato: boolean;
  mesi_fatturazione_fee: number;
  mesi_fatturazione_atleti: number;
};

type EditRow = Omit<ClubRow, "id" | "nome">;

const DEFAULTS: EditRow = {
  fee_fissa_chf: 50,
  prezzo_per_atleta_chf: 1.2,
  costo_setup_chf: 0,
  setup_fatturato: false,
  mesi_fatturazione_fee: 12,
  mesi_fatturazione_atleti: 12,
};

const SuperAdminListinoPage: React.FC = () => {
  const { t } = useTranslation("superadmin");
  const qc = useQueryClient();
  const [search, set_search] = useState("");
  const [edits, set_edits] = useState<Record<string, EditRow>>({});
  const [open_default, set_open_default] = useState(false);
  const [def, set_def] = useState<EditRow>(DEFAULTS);

  const { data: clubs = [] } = useQuery({
    queryKey: ["sa_listino_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, nome, fee_fissa_chf, prezzo_per_atleta_chf, costo_setup_chf, setup_fatturato, mesi_fatturazione_fee, mesi_fatturazione_atleti, attivo")
        .eq("attivo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClubRow[];
    },
  });

  const { data: atleti_counts = {} } = useQuery({
    queryKey: ["sa_listino_atleti_counts", clubs.map((c) => c.id).join(",")],
    enabled: clubs.length > 0,
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(
        clubs.map(async (c) => {
          const { count } = await supabase
            .from("atleti").select("id", { count: "exact", head: true })
            .eq("club_id", c.id).eq("attivo", true);
          out[c.id] = count ?? 0;
        }),
      );
      return out;
    },
  });

  useEffect(() => { set_edits({}); }, [clubs]);

  const get_val = (c: ClubRow): EditRow => edits[c.id] ?? {
    fee_fissa_chf: Number(c.fee_fissa_chf ?? 0),
    prezzo_per_atleta_chf: Number(c.prezzo_per_atleta_chf ?? 0),
    costo_setup_chf: Number(c.costo_setup_chf ?? 0),
    setup_fatturato: !!c.setup_fatturato,
    mesi_fatturazione_fee: Number(c.mesi_fatturazione_fee ?? 12),
    mesi_fatturazione_atleti: Number(c.mesi_fatturazione_atleti ?? 12),
  };

  const set_field = (id: string, k: keyof EditRow, v: number | boolean) => {
    set_edits((s) => {
      const base = s[id] ?? get_val(clubs.find((c) => c.id === id)!);
      return { ...s, [id]: { ...base, [k]: v } };
    });
  };

  const is_dirty = (c: ClubRow) => {
    const e = edits[c.id];
    if (!e) return false;
    return (
      e.fee_fissa_chf !== Number(c.fee_fissa_chf ?? 0) ||
      e.prezzo_per_atleta_chf !== Number(c.prezzo_per_atleta_chf ?? 0) ||
      e.costo_setup_chf !== Number(c.costo_setup_chf ?? 0) ||
      e.setup_fatturato !== !!c.setup_fatturato ||
      e.mesi_fatturazione_fee !== Number(c.mesi_fatturazione_fee ?? 12) ||
      e.mesi_fatturazione_atleti !== Number(c.mesi_fatturazione_atleti ?? 12)
    );
  };

  const salva = useMutation({
    mutationFn: async ({ id, row }: { id: string; row: EditRow }) => {
      const { error } = await supabase.from("clubs").update(row as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast({ title: t("listino.salvato") });
      set_edits((s) => { const c = { ...s }; delete c[v.id]; return c; });
      qc.invalidateQueries({ queryKey: ["sa_listino_full"] });
      qc.invalidateQueries({ queryKey: ["sa_clubs"] });
      qc.invalidateQueries({ queryKey: ["sa_club_detail"] });
    },
    onError: (e: any) => toast({ title: t("listino.errore"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const applica_default = useMutation({
    mutationFn: async () => {
      // applica a tutti i club dove fee=0 OR prezzo=0 (cioe' non valorizzati)
      const target = clubs.filter((c) =>
        !Number(c.fee_fissa_chf) || !Number(c.prezzo_per_atleta_chf),
      );
      for (const c of target) {
        const { error } = await supabase.from("clubs").update(def as any).eq("id", c.id);
        if (error) throw error;
      }
      return target.length;
    },
    onSuccess: (n) => {
      toast({ title: `Default applicato a ${n} club` });
      set_open_default(false);
      qc.invalidateQueries({ queryKey: ["sa_listino_full"] });
    },
    onError: (e: any) => toast({ title: "Errore", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const filtrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter((c) => !q || c.nome.toLowerCase().includes(q));
  }, [clubs, search]);

  const mrr_previsto = useMemo(() => {
    return filtrati.reduce((acc, c) => {
      const v = get_val(c);
      const n = atleti_counts[c.id] ?? 0;
      return acc + v.fee_fissa_chf + n * v.prezzo_per_atleta_chf;
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrati, edits, atleti_counts]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("listino.title")}</h1>
          <p className="text-sm text-muted-foreground">Imposta canone, prezzo/atleta e setup per ciascun club.</p>
        </div>
        <Button variant="outline" onClick={() => set_open_default(true)}>Applica listino default a tutti</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Listino per club</CardTitle>
            <div className="flex items-center gap-3">
              <Input value={search} onChange={(e) => set_search(e.target.value)} placeholder="Cerca club…" className="max-w-xs" />
              <div className="text-sm">
                <span className="text-muted-foreground">MRR previsto totale: </span>
                <b className="tabular-nums">CHF {mrr_previsto.toFixed(2)}</b>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-2">Club</th>
                  <th className="py-2 px-2">Canone CHF</th>
                  <th className="py-2 px-2">Mesi canone</th>
                  <th className="py-2 px-2">Prezzo/atleta CHF</th>
                  <th className="py-2 px-2">Mesi atleti</th>
                  <th className="py-2 px-2">Setup CHF</th>
                  <th className="py-2 px-2">Fatt.?</th>
                  <th className="py-2 px-2 text-right">Mensile previsto</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtrati.map((c) => {
                  const v = get_val(c);
                  const n = atleti_counts[c.id] ?? 0;
                  const mensile = v.fee_fissa_chf + n * v.prezzo_per_atleta_chf;
                  const dirty = is_dirty(c);
                  return (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 px-2 font-medium">
                        {c.nome}
                        <div className="text-xs text-muted-foreground">{n} atleti</div>
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" step="0.01" min={0} className="w-24"
                          value={v.fee_fissa_chf}
                          onChange={(e) => set_field(c.id, "fee_fissa_chf", parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="py-2 px-2">
                        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm w-16"
                          value={v.mesi_fatturazione_fee}
                          onChange={(e) => set_field(c.id, "mesi_fatturazione_fee", parseInt(e.target.value, 10))}>
                          {Array.from({ length: 13 }, (_, i) => i).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" step="0.01" min={0} className="w-24"
                          value={v.prezzo_per_atleta_chf}
                          onChange={(e) => set_field(c.id, "prezzo_per_atleta_chf", parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="py-2 px-2">
                        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm w-16"
                          value={v.mesi_fatturazione_atleti}
                          onChange={(e) => set_field(c.id, "mesi_fatturazione_atleti", parseInt(e.target.value, 10))}>
                          {Array.from({ length: 13 }, (_, i) => i).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" step="0.01" min={0} className="w-24"
                          value={v.costo_setup_chf}
                          onChange={(e) => set_field(c.id, "costo_setup_chf", parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" checked={v.setup_fatturato}
                          onChange={(e) => set_field(c.id, "setup_fatturato", e.target.checked)} />
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">CHF {mensile.toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <Button size="sm" disabled={!dirty || salva.isPending}
                          onClick={() => salva.mutate({ id: c.id, row: v })}>
                          {t("listino.salva")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtrati.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Nessun club</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open_default} onOpenChange={set_open_default}>
        <DialogContent>
          <DialogHeader><DialogTitle>Applica listino default</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Verrà applicato ai soli club con valori non impostati (canone o prezzo a 0).
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Canone base (CHF)</Label>
              <Input type="number" step="0.01" min={0} value={def.fee_fissa_chf}
                onChange={(e) => set_def((d) => ({ ...d, fee_fissa_chf: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mesi canone</Label>
              <Input type="number" min={0} max={12} value={def.mesi_fatturazione_fee}
                onChange={(e) => set_def((d) => ({ ...d, mesi_fatturazione_fee: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prezzo/atleta (CHF)</Label>
              <Input type="number" step="0.01" min={0} value={def.prezzo_per_atleta_chf}
                onChange={(e) => set_def((d) => ({ ...d, prezzo_per_atleta_chf: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mesi atleti</Label>
              <Input type="number" min={0} max={12} value={def.mesi_fatturazione_atleti}
                onChange={(e) => set_def((d) => ({ ...d, mesi_fatturazione_atleti: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Costo setup (CHF)</Label>
              <Input type="number" step="0.01" min={0} value={def.costo_setup_chf}
                onChange={(e) => set_def((d) => ({ ...d, costo_setup_chf: parseFloat(e.target.value) || 0 }))} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={def.setup_fatturato}
                onChange={(e) => set_def((d) => ({ ...d, setup_fatturato: e.target.checked }))} />
              Setup già fatturato
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_open_default(false)}>Annulla</Button>
            <Button onClick={() => applica_default.mutate()} disabled={applica_default.isPending}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminListinoPage;
