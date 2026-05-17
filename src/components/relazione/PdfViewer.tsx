import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, Download, AlertTriangle, ExternalLink } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type PdfDocumentProxy = Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;

interface Props {
  blob: Blob;
  on_download?: () => void;
}

async function load_pdf_from_blob(blob: Blob) {
  try {
    console.log(`[PdfViewer] Blob ricevuto: size=${blob.size} type=${blob.type}`);
    const array_buffer = await blob.arrayBuffer();
    console.log(`[PdfViewer] ArrayBuffer creato: bytes=${array_buffer.byteLength}`);
    const loading_task = pdfjsLib.getDocument({
      data: new Uint8Array(array_buffer),
      cMapUrl: `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    });
    const pdf_document = await loading_task.promise;
    console.log(`[PdfViewer] PDF document caricato: pagine=${pdf_document.numPages}`);
    return pdf_document;
  } catch (error: any) {
    console.error("[PdfViewer] Errore caricamento PDF:", error);
    console.error("[PdfViewer] Stack:", error?.stack);
    console.error("[PdfViewer] Blob size:", blob.size, "type:", blob.type);
    throw error;
  }
}

async function render_page(pdf: PdfDocumentProxy, page_num: number, canvas: HTMLCanvasElement, scale = 1.5) {
  const page = await pdf.getPage(page_num);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context non disponibile");
  const render_task = page.render({ canvasContext: ctx, viewport });
  await render_task.promise;
}

export default function PdfViewer({ blob, on_download }: Props) {
  const [scale, set_scale] = useState(1.3);
  const [total_pages, set_total_pages] = useState(0);
  const [current_page, set_current_page] = useState(1);
  const [is_loading, set_is_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);
  const container_ref = useRef<HTMLDivElement | null>(null);
  const pdf_doc_ref = useRef<any>(null);
  const render_token_ref = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const token = ++render_token_ref.current;
    set_is_loading(true);
    set_error(null);

    (async () => {
      try {
        const buf = await blob.arrayBuffer();
        if (cancelled) return;

        // Distruggi documento precedente
        if (pdf_doc_ref.current) {
          try { await pdf_doc_ref.current.destroy(); } catch {}
          pdf_doc_ref.current = null;
        }

        const loading_task = pdfjsLib.getDocument({ data: buf });
        const pdf = await loading_task.promise;
        if (cancelled || token !== render_token_ref.current) {
          try { await pdf.destroy(); } catch {}
          return;
        }
        pdf_doc_ref.current = pdf;
        set_total_pages(pdf.numPages);

        const container = container_ref.current;
        if (!container) return;
        container.innerHTML = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled || token !== render_token_ref.current) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          const wrapper = document.createElement("div");
          wrapper.className = "bg-white shadow-md mx-auto";
          wrapper.style.marginBottom = "12px";
          wrapper.style.width = `${viewport.width}px`;
          wrapper.dataset.pageNumber = String(i);

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }

        if (!cancelled && token === render_token_ref.current) {
          set_is_loading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("[PdfViewer] errore caricamento", e);
          set_error(e?.message ?? "Errore caricamento PDF");
          set_is_loading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, scale]);

  // Cleanup finale
  useEffect(() => {
    return () => {
      render_token_ref.current++;
      if (pdf_doc_ref.current) {
        try { pdf_doc_ref.current.destroy(); } catch {}
        pdf_doc_ref.current = null;
      }
    };
  }, []);

  // Track scroll → current page
  useEffect(() => {
    const container = container_ref.current?.parentElement;
    if (!container) return;
    const handle = () => {
      const children = Array.from(container_ref.current?.children ?? []) as HTMLElement[];
      const scroll_top = container.scrollTop;
      let best = 1;
      for (const c of children) {
        if (c.offsetTop - 80 <= scroll_top) best = Number(c.dataset.pageNumber ?? best);
      }
      set_current_page(best);
    };
    container.addEventListener("scroll", handle);
    return () => container.removeEventListener("scroll", handle);
  }, [total_pages]);

  const zoom_in = () => set_scale((s) => Math.min(2.5, +(s + 0.2).toFixed(2)));
  const zoom_out = () => set_scale((s) => Math.max(0.6, +(s - 0.2).toFixed(2)));

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 h-12 px-3 bg-white border-b border-slate-200">
        <div className="text-xs text-slate-600 font-medium">
          {total_pages > 0 ? `Pagina ${current_page} di ${total_pages}` : "Caricamento..."}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={zoom_out} disabled={scale <= 0.6} className="h-8 w-8 p-0">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={zoom_in} disabled={scale >= 2.5} className="h-8 w-8 p-0">
            <ZoomIn className="w-4 h-4" />
          </Button>
          {on_download && (
            <Button size="sm" variant="outline" onClick={on_download} className="ml-2 gap-1 h-8 text-xs">
              <Download className="w-3.5 h-3.5" />
              Scarica PDF
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto py-3 relative">
        {is_loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-20">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <p className="text-xs">Caricamento anteprima...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-auto max-w-md p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs text-amber-900">
              Impossibile visualizzare l'anteprima. Scarica il PDF per vederlo.
              {on_download && (
                <Button size="sm" variant="outline" onClick={on_download} className="mt-2 gap-1 h-7 text-xs">
                  <Download className="w-3 h-3" /> Scarica PDF
                </Button>
              )}
            </div>
          </div>
        )}
        <div ref={container_ref} className="px-3" />
      </div>
    </div>
  );
}
