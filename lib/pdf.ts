// Interakcija sa pdf.js (prikaz + izvlačenje pozicija teksta).
// pdf.js se učitava dinamički (lazy) da ne ulazi u inicijalni bundle.
//
// VAŽNO oko koordinata:
//  - pdf.js getTextContent daje transform u PDF "user space" (bottom-left, bez rotacije).
//  - MuPDF redakcija (setRect) radi u prostoru "stranice" koji je top-left,
//    sa primenjenom rotacijom (potvrđeno empirijski za rotacije 0/90/180/270).
//  - Ova dva prostora su IDENTIČNA prostoru koji vraća pdf.js getViewport({scale:1})
//    (tj. viewport sa scale 1 == MuPDF page space). Zato svaki rect konvertujemo
//    kroz scale-1 viewport i čuvamo ga već u MuPDF prostoru.
import type { PdfRect, TextSpan } from "./types";

// ---- Minimalni tipovi za pdf.js (da ne uvozimo celu biblioteku) ----

export interface PdfViewport {
  width: number;
  height: number;
  convertToViewportPoint(x: number, y: number): [number, number];
  convertToPdfPoint(x: number, y: number): [number, number];
}

export interface PdfPageProxy {
  getViewport(params: { scale: number }): PdfViewport;
  getTextContent(): Promise<unknown>;
  render(params: unknown): { promise: Promise<void> };
  cleanup(): void;
}

export interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  // pdf.js v6: destroy() je na loadingTask, ne na dokumentu.
  loadingTask: { destroy(): Promise<void> };
}

interface PdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  hasEOL?: boolean;
}

interface PdfTextContent {
  items: PdfTextItem[];
  styles: Record<string, { ascent?: number; descent?: number; vertical?: boolean }>;
}

export async function openPdf(buffer: ArrayBuffer): Promise<PdfDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  // Prosleđujemo kopiju, jer pdf.js može da "transferuje" buffer u worker
  // (što bi detachovalo original koji nam treba za MuPDF).
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) });
  const doc = await task.promise;
  return doc as unknown as PdfDocumentProxy;
}

/**
 * Iz transform matrice teksta računa bounding box u PDF user space (bottom-left).
 * transform = [a, b, c, d, e, f]:
 *   - (e, f) je početak baseline-a
 *   - (a, b) je vektor napredovanja (advance)
 *   - (c, d) je vektor "gore" (visina fonta)
 */
export function computeTextRect(
  item: PdfTextItem,
  styles: PdfTextContent["styles"]
): PdfRect | null {
  const transform = item.transform;
  if (!transform || transform.length < 6) return null;

  const [a, b, c, d, e, f] = transform;
  const style = item.fontName ? styles[item.fontName] : undefined;
  const vertical = !!style?.vertical;

  const fontHeight = vertical ? Math.hypot(a, b) : Math.hypot(c, d);
  if (!fontHeight) return null;

  // pdf.js: ascent/descent su frakcije em-a; descent je NEGATIVAN (ispod baseline).
  const ascent = Math.abs(style?.ascent ?? 0.8) * fontHeight;
  const descent = Math.abs(style?.descent ?? 0.2) * fontHeight;

  // Vektor napredovanja (advance) — normalizovan.
  const advX = vertical ? c : a;
  const advY = vertical ? d : b;
  const advLen = Math.hypot(advX, advY) || 1;
  const nx = advX / advLen;
  const ny = advY / advLen;

  // Vektor "gore" — normalizovan.
  const upX = vertical ? a : c;
  const upY = vertical ? b : d;
  const upLen = Math.hypot(upX, upY) || 1;
  const mx = upX / upLen;
  const my = upY / upLen;

  const advance = vertical ? item.height ?? 0 : item.width ?? 0;
  const w = Math.max(advance, fontHeight * 0.1);

  const corners: [number, number][] = [
    [e, f],
    [e + nx * w, f + ny * w],
    [e + mx * ascent, f + my * ascent],
    [e + nx * w + mx * ascent, f + ny * w + my * ascent],
    [e - mx * descent, f - my * descent],
    [e + nx * w - mx * descent, f + ny * w - my * descent],
  ];

  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);

  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

/** Konvertuje rect iz PDF user space u viewport prostor (MuPDF prostor za scale=1). */
export function convertRectToViewport(rect: PdfRect, viewport: PdfViewport): PdfRect {
  const pts = [
    viewport.convertToViewportPoint(rect.x0, rect.y0),
    viewport.convertToViewportPoint(rect.x0, rect.y1),
    viewport.convertToViewportPoint(rect.x1, rect.y0),
    viewport.convertToViewportPoint(rect.x1, rect.y1),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

/**
 * Izvlači sve tekstualne span-ove sa pozicijama, za sve stranice.
 * rect je u MuPDF prostoru (top-left, rotacija primenjena, PDF points).
 */
export async function extractTextSpans(doc: PdfDocumentProxy): Promise<TextSpan[]> {
  const spans: TextSpan[] = [];

  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
    const page = await doc.getPage(pageIndex + 1);
    try {
      const viewport1 = page.getViewport({ scale: 1 });
      const content = (await page.getTextContent()) as unknown as PdfTextContent;

      content.items.forEach((item, i) => {
        const str = item.str;
        if (!str || !str.trim()) return;
        const pdfRect = computeTextRect(item, content.styles);
        if (!pdfRect) return;
        if (pdfRect.x1 <= pdfRect.x0 || pdfRect.y1 <= pdfRect.y0) return;
        const rect = convertRectToViewport(pdfRect, viewport1);
        if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return;
        spans.push({ id: `${pageIndex}:${i}`, page: pageIndex, str, rect });
      });
    } finally {
      page.cleanup();
    }
  }

  return spans;
}
