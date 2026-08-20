// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 lin <nemjov95@gmail.com>

// Kopira statičke resurse iz node_modules u public/,
// kako bi se MuPDF WASM i pdf.js worker servirali direktno
// (bez prolaska kroz bundler).
import { cp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const jobs = [
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs"],
  ["node_modules/mupdf/dist/mupdf.js", "public/mupdf/mupdf.js"],
  ["node_modules/mupdf/dist/mupdf-wasm.js", "public/mupdf/mupdf-wasm.js"],
  ["node_modules/mupdf/dist/mupdf-wasm.wasm", "public/mupdf/mupdf-wasm.wasm"],
  // Pre-compressed (.br) varijante — Vercel ih servira kada browser
  // podržava brotli (smanjuje WASM sa ~10MB na ~3.6MB).
  ["node_modules/mupdf/dist/mupdf.js.br", "public/mupdf/mupdf.js.br"],
  ["node_modules/mupdf/dist/mupdf-wasm.js.br", "public/mupdf/mupdf-wasm.js.br"],
  ["node_modules/mupdf/dist/mupdf-wasm.wasm.br", "public/mupdf/mupdf-wasm.wasm.br"],
  // AGPL §4: uz distribuirani MuPDF WASM obavezno ide i tekst licence.
  ["node_modules/mupdf/LICENSE", "public/mupdf/LICENSE.mupdf.txt"],
  // Apache-2.0 §4(a): uz distribuirani pdf.js worker ide i pun tekst licence.
  ["node_modules/pdfjs-dist/LICENSE", "public/pdfjs-LICENSE.txt"],
];

await mkdir(join(root, "public/mupdf"), { recursive: true });

for (const [from, to] of jobs) {
  await cp(join(root, from), join(root, to));
  console.log(`copied: ${from} -> ${to}`);
}

console.log("Static assets ready.");
