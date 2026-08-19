// Pravo uklanjanje teksta pomoću MuPDF-a (WebAssembly).
// MuPDF se učitava dinamički sa statičke lokacije (/public/mupdf),
// tako da bundler (Turbopack/webpack) ne obrađuje njegov WASM.
import type { Selection } from "./types";

type MupdfModule = typeof import("mupdf");
type MupdfDocument = import("mupdf").PDFDocument;

let mupdfPromise: Promise<MupdfModule> | null = null;

export function loadMupdf(): Promise<MupdfModule> {
  if (!mupdfPromise) {
    mupdfPromise = (async () => {
      // URL se gradi iz runtime vrednosti (document.baseURI) tako da bundler
      // ne može da ga statički razreši — import ostaje nativni (browser) import.
      const base = document.baseURI.endsWith("/")
        ? document.baseURI
        : `${document.baseURI}/`;
      const url = `${base}mupdf/mupdf.js`;
      const mod = (await import(/* webpackIgnore: true */ url)) as MupdfModule;
      return mod;
    })();
  }
  return mupdfPromise;
}

/**
 * Fizički uklanja sav sadržaj unutar zadatih regiona (ne samo maskira).
 * selections[].rect su već u MuPDF page space (top-left, rotirano) —
 * prosleđujemo ih direktno setRect. Vraća novi PDF kao ArrayBuffer.
 */
export async function redactPdf(
  buffer: ArrayBuffer,
  selections: Selection[]
): Promise<ArrayBuffer> {
  const mupdf = await loadMupdf();

  const byPage = new Map<number, Selection[]>();
  for (const sel of selections) {
    const list = byPage.get(sel.page);
    if (list) list.push(sel);
    else byPage.set(sel.page, [sel]);
  }

  const doc = mupdf.Document.openDocument(
    buffer,
    "application/pdf"
  ) as unknown as MupdfDocument;

  try {
    for (const [pageIndex, sels] of byPage) {
      if (!sels.length) continue;
      const page = doc.loadPage(pageIndex);

      for (const sel of sels) {
        const ann = page.createAnnotation("Redact");
        ann.setRect([sel.rect.x0, sel.rect.y0, sel.rect.x1, sel.rect.y1]);
        ann.update();
      }

      // Trajno uklanja tekst/sadržaj unutar redakcionih regiona.
      page.applyRedactions();
    }

    const out = doc.saveToBuffer("");
    // Kopija sa čistim (tačnim) bufferom.
    return out.asUint8Array().slice().buffer as ArrayBuffer;
  } finally {
    doc.destroy();
  }
}
