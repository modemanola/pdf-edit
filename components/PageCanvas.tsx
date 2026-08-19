"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { PdfDocumentProxy, PdfPageProxy, PdfViewport } from "@/lib/pdf";
import type { PdfRect, Selection, TextSpan } from "@/lib/types";

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PageCanvasProps {
  pageIndex: number;
  doc: PdfDocumentProxy;
  spans: TextSpan[];
  selectedIds: Set<string>;
  matchIds: Set<string>;
  regions: Selection[];
  targetWidth: number;
  onToggleSpan: (span: TextSpan) => void;
  onAddRegion: (rect: PdfRect) => void;
  onRemoveRegion: (id: string) => void;
}

export default function PageCanvas({
  pageIndex,
  doc,
  spans,
  selectedIds,
  matchIds,
  regions,
  targetWidth,
  onToggleSpan,
  onAddRegion,
  onRemoveRegion,
}: PageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [page, setPage] = useState<PdfPageProxy | null>(null);
  const [viewport, setViewport] = useState<PdfViewport | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [inView, setInView] = useState(false);
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  const marqueeRef = useRef<Marquee | null>(null);
  const scaleRef = useRef(1);

  // Lazy render: canvas se iscrtava tek kad stranica uđe blizu viewport-a.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Učitavamo page proxy (jeftino) da bismo znali dimenzije za placeholder.
  useEffect(() => {
    let cancelled = false;
    doc.getPage(pageIndex + 1).then((p) => {
      if (cancelled) {
        p.cleanup();
        return;
      }
      const base = p.getViewport({ scale: 1 });
      setPage(p);
      setDimensions({ w: base.width, h: base.height });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex]);

  useEffect(() => {
    return () => {
      page?.cleanup();
    };
  }, [page]);

  // Render kanvasa (jednom, kada je stranica u viewport-u).
  useEffect(() => {
    if (!inView || !page) return;
    let cancelled = false;

    (async () => {
      const base = page.getViewport({ scale: 1 });
      const s = targetWidth / base.width;
      const vp = page.getViewport({ scale: s });
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      await page.render({
        canvasContext: ctx,
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;

      if (!cancelled) {
        scaleRef.current = s;
        setViewport(vp);
        setScale(s);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inView, page, targetWidth]);

  // ---- Marquee (selekcija regiona prevlačenjem) ----

  const clearMarquee = useCallback(() => {
    marqueeRef.current = null;
    setMarquee(null);
  }, []);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-span], [data-region]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = { x0: x, y0: y, x1: x, y1: y };
    marqueeRef.current = m; // sinhrono, da move/up odmah vide vrednost
    setMarquee(m);
  }, []);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marqueeRef.current;
    if (!m) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const next = { ...m, x1: e.clientX - rect.left, y1: e.clientY - rect.top };
    marqueeRef.current = next;
    setMarquee(next);
  }, []);

  const handlePointerUp = useCallback(
    () => {
      const m = marqueeRef.current;
      // Bitno: čisti i ref i state, inače kasniji pointermove ponovo
      // "oživi" selekciju nakon puštanja miša.
      marqueeRef.current = null;
      setMarquee(null);
      if (!m) return;

      const x0 = Math.min(m.x0, m.x1);
      const y0 = Math.min(m.y0, m.y1);
      const x1 = Math.max(m.x0, m.x1);
      const y1 = Math.max(m.y0, m.y1);

      if (x1 - x0 < 4 || y1 - y0 < 4) return; // preslab "klik", ne selekcija

      // Ekranski (CSS px) -> MuPDF prostor (points): delimo skalom.
      const s = scaleRef.current || 1;
      onAddRegion({
        x0: x0 / s,
        y0: y0 / s,
        x1: x1 / s,
        y1: y1 / s,
      });
    },
    [onAddRegion]
  );

  const placeholderStyle: CSSProperties | undefined =
    !viewport && dimensions
      ? { width: targetWidth, height: dimensions.h * (targetWidth / dimensions.w) }
      : undefined;

  const marqueeStyle: CSSProperties | undefined = marquee
    ? {
        left: Math.min(marquee.x0, marquee.x1),
        top: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
      }
    : undefined;

  // rect (MuPDF prostor, points) -> ekran (CSS px): uniformno skaliranje.
  const toScreen = (r: PdfRect) => ({
    left: r.x0 * scale,
    top: r.y0 * scale,
    width: (r.x1 - r.x0) * scale,
    height: (r.y1 - r.y0) * scale,
  });

  return (
    <div className="page-canvas" ref={wrapRef} style={placeholderStyle}>
      <canvas ref={canvasRef} className="page-canvas__surface" />

      {viewport && (
        <div
          className="page-overlay"
          style={{ width: viewport.width, height: viewport.height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={clearMarquee}
          onLostPointerCapture={clearMarquee}
        >
          {spans.map((span) => {
            const r = toScreen(span.rect);
            const selected = selectedIds.has(span.id);
            const matched = matchIds.has(span.id);
            const cls = [
              "text-span",
              selected ? "text-span--selected" : "",
              matched && !selected ? "text-span--match" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={span.id}
                data-span="1"
                className={cls}
                style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                title={span.str}
                onClick={() => onToggleSpan(span)}
              />
            );
          })}

          {regions.map((reg) => {
            const r = toScreen(reg.rect);
            return (
              <div
                key={reg.id}
                data-region="1"
                className="region-box"
                style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveRegion(reg.id);
                }}
                title="Klikni da ukloniš region"
              >
                <span className="region-box__x">✕</span>
              </div>
            );
          })}

          {marqueeStyle && <div className="marquee" style={marqueeStyle} />}
        </div>
      )}
    </div>
  );
}
