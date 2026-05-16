import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { CATEGORIE_ALLEGATO } from "./categorie";

interface Props {
  open: boolean;
  on_close: () => void;
  club_id: string;
  stagione_id: string;
  allegato: any | null;
  default_ordine: number;
}

const MAX_BYTES = 20 * 1024 * 1024;

export default function AllegatoForm({ open, on_close, club_id, stagione_id, allegato, default_ordine }: Props) {
  const qc = useQueryClient();
  const [categoria, set_categoria] = useState("bilancio");
  const [titolo, set_titolo] = useState("");
  const [descrizione, set_descrizione] = useState("");
  const [ordine, set_ordine] = useState<number>(default_ordine);
  const [permanente, set_permanente] = useState(false);
  const [file, set_file] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      set_categoria(allegato?.categoria ?? "bilancio");
      set_titolo(allegato?.titolo ?? "");
      set_descrizione(allegato?.descrizione ?? "");
      set_ordine(allegato?.ordine ?? default_ordine);
      set_permanente(allegato ? allegato.stagione_id === null : false);
      set_file(null);
    }
  }, [open, allegato, default_ordine]);

  const m_save = useMutation({
    mutationFn: async () => {
      let file_url = allegato?.file_url ?? "placeholder://new-file.pdf";
      let file_size_bytes = allegato?.file_size_bytes ?? null;
      let upload_failed = false;

      if (file) {
        if (file.size > MAX_BYTES) throw new Error("File troppo grande (max 20MB)");
        const path = `${club_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: up_err } = await supabase.storage.from("relazioni-allegati").upload(path, file, {
          contentType: file.type || "application/pdf",
          upsert: false,
        });
        if (up_err) {
          upload_failed = true;
          file_url = `placeholder://${file.name}`;
          file_size_bytes = file.size;
        } else {
          file_url = path;
          file_size_bytes = file.size;
        }
      }

      const payload = {
        club_id,
        stagione_id: permanente ? null : stagione_id,
        categoria,
        titolo: titolo.trim(),
        descrizione: descrizione.trim() || null,
        ordine,
        file_url,
        file_size_bytes,
        mime_type: file?.type || allegato?.mime_type || "application/pdf",
      };

      if (allegato?.id) {
        const { error } = await supabase.from("relazioni_allegati" as any).update(payload).eq("id", allegato.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("relazioni_allegati" as any).insert(payload);
        if (error) throw error;
      }

      return { upload_failed };
    },
    onSuccess: ({ upload_failed }) => {
      qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] });
      if (upload_failed) {
        toast.warning("Storage non disponibile, file salvato solo come riferimento");
      } else {
        toast.success(allegato ? "Allegato aggiornato" : "Allegato creato");
      }
      on_close();
    },
    onError: (e: any) => toast.error(e.message ?? "Errore salvataggio"),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && on_close()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{allegato ? "Modifica allegato" : "Nuovo allegato"}</SheetTitle>
          <SheetDescription>Documento PDF per la relazione del Presidente.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={set_categoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIE_ALLEGATO.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Titolo</Label>
            <Input value={titolo} onChange={(e) => set_titolo(e.target.value)} placeholder="Es. Bilancio Stagione 2025/2026" />
          </div>
          <div>
            <Label>Descrizione (opzionale)</Label>
            <Textarea value={descrizione} onChange={(e) => set_descrizione(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Ordine</Label>
            <Input type="number" value={ordine} onChange={(e) => set_ordine(parseInt(e.target.value) || 0)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Permanente (tutte le stagioni)</Label>
              <p className="text-xs text-muted-foreground">Se attivo, non viene legato alla stagione corrente.</p>
            </div>
            <Switch checked={permanente} onCheckedChange={set_permanente} />
          </div>
          <div>
            <Label>File PDF (max 20MB)</Label>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => set_file(e.target.files?.[0] ?? null)}
            />
            {allegato && !file && (
              <p className="text-xs text-muted-foreground mt-1">File corrente: {allegato.file_url}</p>
            )}
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={on_close}>Annulla</Button>
          <Button onClick={() => m_save.mutate()} disabled={!titolo.trim() || m_save.isPending}>Salva</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
