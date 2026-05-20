import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/pdf";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, Download, AlertTriangle, ExternalLink } from "lucide-react";
import "pdfjs-dist/web/pdf_viewer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface Props {
  blob: Blob;
  on_download?: () => void;
}

interface PdfPageCanvasProps {
  pdf: PDFDocumentProxy;
  page_num: number;
  total_pages: number;
  scale: number;
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

async function render_page(pdf: PDFDocumentProxy, page_num: number, canvas: HTMLCanvasElement, scale = 1.5) {
  const page = await pdf.getPage(page_num);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context non disponibile");
  const render_task = page.render({ canvasContext: ctx, viewport, canvas });
  await render_task.promise;
}

function PdfPageCanvas({ pdf, page_num, total_pages, scale }: PdfPageCanvasProps) {
  const canvas_ref = useRef<HTMLCanvasElement | null>(null);
  const [page_width, set_page_width] = useState<number | null>(null);
  const render_token_ref = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const token = ++render_token_ref.current;

    (async () => {
      try {
        const canvas = canvas_ref.current;
        if (!canvas) return;
        const page = await pdf.getPage(page_num);
        const viewport = page.getViewport({ scale });
        set_page_width(viewport.width);
        await render_page(pdf, page_num, canvas, scale);
        if (!cancelled && token === render_token_ref.current) {
          console.log(`[PdfViewer] Render pagina ${page_num}/${total_pages} completato`);
        }
      } catch (error: any) {
        if (!cancelled) {
          console.error(`[PdfViewer] Errore render pagina ${page_num}:`, error);
          console.error("[PdfViewer] Stack:", error?.stack);
        }
      }
    })();

    return () => {
      cancelled = true;
      render_token_ref.current++;
    };
  }, [pdf, page_num, scale, total_pages]);

  return (
    <div
      className="bg-background shadow-md mx-auto mb-3"
      data-page-number={page_num}
      style={page_width ? { width: `${page_width}px` } : undefined}
    >
      <canvas ref={canvas_ref} className="block max-w-full" />
    </div>
  );
}

export default function PdfViewer({ blob, on_download }: Props) {
  const [scale, set_scale] = useState(1.3);
  const [pdf_doc, set_pdf_doc] = useState<PDFDocumentProxy | null>(null);
  const [total_pages, set_total_pages] = useState(0);
  const [current_page, set_current_page] = useState(1);
  const [is_loading, set_is_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);
  const container_ref = useRef<HTMLDivElement | null>(null);
  const fallback_url_ref = useRef<string | null>(null);
  const render_token_ref = useRef(0);

  const pages = useMemo(() => Array.from({ length: total_pages }, (_, index) => index + 1), [total_pages]);

  useEffect(() => {
    let cancelled = false;
    let current_pdf: PDFDocumentProxy | null = null;
    const token = ++render_token_ref.current;
    set_is_loading(true);
    set_error(null);
    set_pdf_doc(null);
    set_total_pages(0);
    set_current_page(1);

    (async () => {
      try {
        const pdf = await load_pdf_from_blob(blob);
        current_pdf = pdf;
        if (cancelled || token !== render_token_ref.current) {
          await pdf.destroy();
          return;
        }
        set_pdf_doc(pdf);
        set_total_pages(pdf.numPages);
        set_is_loading(false);
      } catch (e: any) {
        if (!cancelled) {
          console.error("[PdfViewer] Errore:", e);
          set_error(e?.message ?? "Errore caricamento PDF");
          set_is_loading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      render_token_ref.current++;
      if (current_pdf) {
        try {
          current_pdf.destroy();
        } catch (destroy_error) {
          console.error("[PdfViewer] Errore cleanup PDF:", destroy_error);
        }
      }
      if (fallback_url_ref.current) {
        URL.revokeObjectURL(fallback_url_ref.current);
        fallback_url_ref.current = null;
      }
    };
  }, [blob]);

  useEffect(() => {
    const container = container_ref.current;
    if (!container) return;
    const handle_scroll = () => {
      const children = Array.from(container.children) as HTMLElement[];
      const scroll_top = container.scrollTop;
      let best = 1;
      for (const child of children) {
        if (child.offsetTop - 80 <= scroll_top) best = Number(child.dataset.pageNumber ?? best);
      }
      set_current_page(best);
    };
    container.addEventListener("scroll", handle_scroll);
    return () => container.removeEventListener("scroll", handle_scroll);
  }, [total_pages]);

  const zoom_in = () => set_scale((s) => Math.min(2.5, +(s + 0.2).toFixed(2)));
  const zoom_out = () => set_scale((s) => Math.max(0.6, +(s - 0.2).toFixed(2)));
  const open_in_new_tab = () => {
    if (fallback_url_ref.current) URL.revokeObjectURL(fallback_url_ref.current);
    const url = URL.createObjectURL(blob);
    fallback_url_ref.current = url;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-muted">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 h-12 px-3 bg-background border-b border-border">
        <div className="text-xs text-muted-foreground font-medium">
          {total_pages > 0 ? `Pagina ${current_page} di ${total_pages}` : "Caricamento..."}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={zoom_out} disabled={scale <= 0.6} className="h-8 w-8 p-0">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
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
      <div ref={container_ref} className="flex-1 overflow-auto py-3 relative px-3">
        {is_loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-20">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Caricamento anteprima...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-auto max-w-md p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs text-amber-900">
              <p>Errore visualizzatore PDF: {error}. Puoi comunque scaricare il file.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {on_download && (
                  <Button size="sm" variant="outline" onClick={on_download} className="gap-1 h-8 text-xs">
                    <Download className="w-3 h-3" /> Scarica PDF
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={open_in_new_tab} className="gap-1 h-8 text-xs">
                  <ExternalLink className="w-3 h-3" /> Apri in nuova scheda
                </Button>
              </div>
            </div>
          </div>
        )}
        {!error && pdf_doc && pages.map((page_num) => (
          <PdfPageCanvas key={`${page_num}-${scale}`} pdf={pdf_doc} page_num={page_num} total_pages={total_pages} scale={scale} />
        ))}
      </div>
    </div>
  );
}
