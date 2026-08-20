// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 lin

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Redactor — ukloni tekst iz PDF-a",
  description:
    "Klijentska aplikacija za pravo uklanjanje teksta iz PDF dokumenata, bez slanja fajla na server.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
