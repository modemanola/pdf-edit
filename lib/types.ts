// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 lin <nemjov95@gmail.com>

// Koordinatni sistem rect-ova (PdfRect) kroz celu aplikaciju:
//   MuPDF "page space" — origin gore-levo, Y na dole, rotacija primenjena, u PDF points.
// Ovo je identično prostoru koji vraća pdf.js getViewport({ scale: 1 }),
// pa se rect-ovi direktno prosleđuju MuPDF setRect bez dodatne konverzije.

export interface PdfRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextSpan {
  id: string; // `${pageIndex}:${itemIndex}`
  page: number; // 0-based indeks stranice
  str: string;
  rect: PdfRect;
}

export interface Selection {
  id: string;
  page: number;
  rect: PdfRect;
  kind: "text" | "region";
}
