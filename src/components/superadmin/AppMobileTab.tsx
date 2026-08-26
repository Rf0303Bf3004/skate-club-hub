import { useEffect, useState } from "react";
import { Smartphone, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { use_qr_data_url } from "@/hooks/use-qr-data-url";



interface Props {
  on_log?: (msg: string) => void;
}

export default function AppMobileTab({ on_log }: Props) {
  const [id, set_id] = useState<string | null>(null);
  const [ios_store_url, set_ios_store_url] = useState("");
  const [android_store_url, set_android_store_url] = useState("");
  const [loading, set_loading] = useState(true);
  const qr_ios = use_qr_data_url(ios_store_url.trim(), 200);
  const qr_android = use_qr_data_url(android_store_url.trim(), 200);
  const [salvando, set_salvando] = useState(false);

  const carica = async () => {
    set_loading(true);
    const { data } = await supabase
      .from("impostazioni_app_mobile")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      set_id(data.id);
      set_ios_store_url(data.ios_store_url ?? "");
      set_android_store_url(data.android_store_url ?? "");
    }
    set_loading(false);
  };

  useEffect(() => {
    carica();
  }, []);

  const salva = async () => {
    set_salvando(true);
    try {
      const payload = {
        ios_store_url: ios_store_url.trim() || null,
        android_store_url: android_store_url.trim() || null,
      };
      if (id) {
        const { error } = await supabase
          .from("impostazioni_app_mobile")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("impostazioni_app_mobile")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        set_id(data.id);
      }
      toast({ title: "✅ Link store aggiornati" });
      on_log?.("✅ Aggiornati link store app mobile");
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_salvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Link store app mobile Ice Arena</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Questi link vengono mostrati (con QR) nella scheda genitori dell'atleta. Aggiornali
          quando l'app sarà pubblicata sugli store.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          {[
            {
              label: "📲 iPhone — App Store (iOS)",
              valore: ios_store_url,
              qr: qr_ios,
              set: set_ios_store_url,
              placeholder: "https://apps.apple.com/app/ice-arena/id0000000000",
            },
            {
              label: "🤖 Android — Google Play",
              valore: android_store_url,
              qr: qr_android,
              set: set_android_store_url,
              placeholder: "https://play.google.com/store/apps/details?id=com.icearena.app",
            },
          ].map((f) => (
            <div key={f.label} className="space-y-2">
              <Label className="text-xs font-semibold">{f.label}</Label>
              <Input
                value={f.valore}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
              />
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3">
                {f.valore.trim() && f.qr ? (
                  <img
                    src={f.qr}
                    alt={`QR ${f.label}`}
                    className="w-24 h-24 rounded bg-white"
                  />
                ) : (
                  <div className="w-24 h-24 rounded border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground text-center px-2">
                    Nessun link
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground break-all">
                  {f.valore.trim() || "Link non ancora disponibile"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={salva} disabled={salvando} className="gap-2">
            <Save className="w-4 h-4" /> {salvando ? "Salvataggio..." : "Salva"}
          </Button>
        </div>
      </div>
    </div>
  );
}
