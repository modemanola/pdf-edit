// Izvoz PDF stranica u PNG (jedan PNG po stranici), 100% klijentski.
import { loadMupdf } from "./redact";

export interface PngExport {
  data: Uint8Array<ArrayBuffer>;
  name: string;
}

export async function exportPngs(
  buffer: ArrayBuffer,
  baseName: string
): Promise<PngExport[]> {
  const mupdf = await loadMupdf();
  const doc = mupdf.Document.openDocument(
    buffer,
    "application/pdf"
  ) as unknown as import("mupdf").PDFDocument;

  const results: PngExport[] = [];
  const scale = 150 / 72; // 150 DPI
  const base = (baseName || "dokument").replace(/\.pdf$/i, "");

  try {
    const pageCount = doc.countPages();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const pix = page.toPixmap(
        mupdf.Matrix.scale(scale, scale),
        mupdf.ColorSpace.DeviceRGB,
        false
      );
      // asPNG() interno radi HEAPU8.slice, ali kopiramo u čist ArrayBuffer
      // da tip bude Uint8Array<ArrayBuffer> (pogodno za Blob).
      const png = pix.asPNG();
      const copy = new Uint8Array(png.byteLength);
      copy.set(png);
      results.push({
        data: copy,
        name: `${base}-strana-${String(i + 1).padStart(2, "0")}.png`,
      });
      pix.destroy();
    }
  } finally {
    doc.destroy();
  }

  return results;
}
