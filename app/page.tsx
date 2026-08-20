// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 lin

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageCanvas from "@/components/PageCanvas";
import { extractTextSpans, openPdf, type PdfDocumentProxy } from "@/lib/pdf";
import { redactPdf } from "@/lib/redact";
import { exportPngs } from "@/lib/export";
import type { PdfRect, Selection, TextSpan } from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "processing" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [doc, setDoc] = useState<PdfDocumentProxy | null>(null);
  const [spans, setSpans] = useState<TextSpan[]>([]);
  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());
  const [query, setQuery] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [targetWidth, setTargetWidth] = useState(860);
  const [dragging, setDragging] = useState(false);

  const docRef = useRef<PdfDocumentProxy | null>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const regionCounter = useRef(0);

  // Responsivna širina prikaza.
  useEffect(() => {
    if (!doc) return;
    const el = document.getElementById("viewer");
    if (!el) return;
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setTargetWidth(Math.max(280, Math.min(el.clientWidth, 900)));
      }, 120);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [doc]);

  const loadPdf = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setStatus("loading");
    setError(null);
    setSuccess(null);
    try {
      if (docRef.current) {
        // Mora da se sačeka: pdf.js deli isti worker, a destroy() ga
        // sinhrono označava kao _pendingDestroy (novi getDocument bi pao).
        await docRef.current.loadingTask.destroy().catch(() => {});
        docRef.current = null;
      }
      const newDoc = await openPdf(buffer);
      docRef.current = newDoc;
      const newSpans = await extractTextSpans(newDoc);
      bufferRef.current = buffer;
      setDoc(newDoc);
      setSpans(newSpans);
      setSelections(new Map());
      setFileName(name);
      setStatus("ready");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Molim te izaberi PDF fajl.");
        setStatus("error");
        return;
      }
      setResultUrl(null);
      const buffer = await file.arrayBuffer();
      await loadPdf(buffer, file.name);
    },
    [loadPdf]
  );

  const toggleSpan = useCallback((span: TextSpan) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(span.id)) {
        next.delete(span.id);
      } else {
        next.set(span.id, { id: span.id, page: span.page, rect: span.rect, kind: "text" });
      }
      return next;
    });
  }, []);

  const addRegion = useCallback((page: number, rect: PdfRect) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const id = `region-${++regionCounter.current}`;
      next.set(id, { id, page, rect, kind: "region" });
      return next;
    });
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearSelections = useCallback(() => setSelections(new Map()), []);

  const spanById = useMemo(() => {
    const m = new Map<string, TextSpan>();
    for (const s of spans) m.set(s.id, s);
    return m;
  }, [spans]);

  const matchIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<string>();
    const set = new Set<string>();
    for (const s of spans) {
      if (s.str.toLowerCase().includes(q)) set.add(s.id);
    }
    return set;
  }, [query, spans]);

  const matchCount = matchIds.size;

  const selectAllMatches = useCallback(() => {
    if (!matchIds.size) return;
    setSelections((prev) => {
      const next = new Map(prev);
      for (const id of matchIds) {
        const span = spanById.get(id);
        if (span) next.set(id, { id, page: span.page, rect: span.rect, kind: "text" });
      }
      return next;
    });
  }, [matchIds, spanById]);

  const handleRemove = useCallback(async () => {
    if (!bufferRef.current) return;
    if (selections.size === 0) {
      setError("Prvo označi tekst (klikom) ili region (prevlačenjem miša po dokumentu).");
      return;
    }
    setStatus("processing");
    setError(null);
    setSuccess(null);
    try {
      const selList = Array.from(selections.values());
      const newBuffer = await redactPdf(bufferRef.current, selList);

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const blob = new Blob([newBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);

      // Ponovo učitaj izmenjen dokument radi daljeg uređivanja.
      const nextName = fileName
        ? `${fileName.replace(/\.pdf$/i, "")}-izmenjeno.pdf`
        : "izmenjeno.pdf";
      await loadPdf(newBuffer.slice(0), nextName);
      setSuccess(`Uklonjeno ${selList.length} ${selList.length === 1 ? "region" : "regiona"} — izmenjen PDF je spreman za preuzimanje.`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("ready");
    }
  }, [selections, resultUrl, fileName, loadPdf]);

  const handleExportPng = useCallback(async () => {
    if (!bufferRef.current || !fileName) return;
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const pngs = await exportPngs(bufferRef.current, fileName);
      for (let i = 0; i < pngs.length; i++) {
        const blob = new Blob([pngs[i].data], { type: "image/png" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pngs[i].name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Kraća pauza da browser ne blokira višestruke download-e.
        if (i < pngs.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
        URL.revokeObjectURL(url);
      }
      setSuccess(`Izvezeno ${pngs.length} PNG ${pngs.length === 1 ? "fajl" : "fajlova"}.`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [fileName]);

  const pageCount = doc?.numPages ?? 0;

  const selectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of selections.values()) if (s.kind === "text") set.add(s.id);
    return set;
  }, [selections]);

  const regionsByPage = useMemo(() => {
    const map = new Map<number, Selection[]>();
    for (const s of selections.values()) {
      if (s.kind !== "region") continue;
      const list = map.get(s.page) ?? [];
      list.push(s);
      map.set(s.page, list);
    }
    return map;
  }, [selections]);

  const spansByPage = useMemo(() => {
    const map = new Map<number, TextSpan[]>();
    for (const s of spans) {
      const list = map.get(s.page) ?? [];
      list.push(s);
      map.set(s.page, list);
    }
    return map;
  }, [spans]);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>PDF Redactor</h1>

        {doc && (
          <>
            <div className="toolbar__search">
              <input
                type="text"
                placeholder="Pretraži tekst…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim() !== "" && (
                <button onClick={selectAllMatches} disabled={!matchCount}>
                  Označi sve ({matchCount})
                </button>
              )}
            </div>

            <div className="toolbar__actions">
              <button
                className="primary"
                onClick={handleRemove}
                disabled={status === "processing"}
              >
                {status === "processing" ? "Brišem…" : "Ukloni označeno iz PDF-a"}
              </button>
              <button onClick={clearSelections} disabled={!selections.size}>
                Poništi selekciju ({selections.size})
              </button>
              <button onClick={() => inputRef.current?.click()}>Otvori drugi PDF</button>
              <button onClick={handleExportPng} disabled={exporting || status === "processing"}>
                {exporting ? "Izvozim…" : "Izvezi PNG"}
              </button>
              {resultUrl && (
                <a className="download" href={resultUrl} download={fileName ?? "redacted.pdf"}>
                  ⬇ Preuzmi izmenjen PDF
                </a>
              )}
            </div>
          </>
        )}
      </header>

      {error && <div className="notice notice--error">{error}</div>}
      {success && <div className="notice notice--success">{success}</div>}

      {!doc ? (
        <div
          className={`dropzone ${dragging ? "dropzone--active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div>
            <strong>Ubaci PDF ovde</strong>
            <p>ili klikni da izabereš fajl</p>
            <p className="dropzone__hint">
              Sve se dešava u tvom browseru — fajl se nikada ne šalje na server.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="statusbar">
            <span>{fileName}</span>
            <span>{pageCount} stranica</span>
            {status === "loading" && <span className="statusbar__loading">Učitavam…</span>}
            {status === "processing" && (
              <span className="statusbar__loading">Uklanjam tekst (MuPDF WASM)…</span>
            )}
          </div>

          <div className="hint">
            Klikni na tekst da ga označiš za brisanje · prevuci mišem da označiš region · koristi
            pretragu za &quot;označi sve&quot;.
          </div>

          <main id="viewer" className="viewer">
            {Array.from({ length: pageCount }, (_, i) => (
              <PageCanvas
                key={i}
                pageIndex={i}
                doc={doc}
                spans={spansByPage.get(i) ?? []}
                selectedIds={selectedIds}
                matchIds={matchIds}
                regions={regionsByPage.get(i) ?? []}
                targetWidth={targetWidth}
                onToggleSpan={toggleSpan}
                onAddRegion={(rect) => addRegion(i, rect)}
                onRemoveRegion={removeSelection}
              />
            ))}
          </main>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <footer className="license-notice">
        <p>
          Ovaj softver je slobodan softver licenciran pod{" "}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noreferrer"
          >
            GNU Affero General Public License v3 (ili novijom)
          </a>
          .
        </p>
        <p>
          <a
            href="https://github.com/modemanola/pdf-edit"
            target="_blank"
            rel="noreferrer"
          >
            Izvorni kod
          </a>{" "}
          je javno dostupan.
        </p>
        <p>
          Pokreće ga{" "}
          <a href="https://mupdf.com" target="_blank" rel="noreferrer">
            MuPDF (AGPL)
          </a>{" "}
          i{" "}
          <a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noreferrer">
            PDF.js (Apache-2.0)
          </a>
          .
        </p>
        <p>
          Kontakt:{" "}
          <a href="mailto:samolagano73@gmail.com">samolagano73@gmail.com</a>
        </p>
      </footer>
    </div>
  );
}
