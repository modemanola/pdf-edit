# PDF Redactor

Klijentska web aplikacija koja **fizički uklanja tekst** iz PDF dokumenata (ne samo maskira), 100% u browseru — fajl se nikada ne šalje na server.

## Kako radi

1. **Upload** — PDF se učitava u memoriju (drag & drop ili file picker).
2. **Prikaz + selekcija** — [pdf.js](https://mozilla.github.io/pdf.js/) renderuje stranice i daje pozicije teksta (`getTextContent`). Korisnik:
   - klikće na tekst da ga označi za brisanje,
   - prevlači mišem da označi proizvoljan region,
   - koristi pretragu da označi sva poklapanja.
3. **Brisanje** — [MuPDF](https://mupdf.com) kompajliran u WebAssembly kreira `Redact` anotacije i poziva `applyRedactions()`, što trajno uklanja tekst/sadržaj unutar regiona.
4. **Download** — izmenjen PDF se preuzima kao Blob.

## Arhitektura

- **Next.js 16 + React 19 + TypeScript** (App Router, statički export).
- **pdf.js** se učitava dinamički za prikaz i izvlačenje pozicija teksta.
- **MuPDF WASM** se servira kao statički fajl (`public/mupdf/`) i učitava dinamički u runtime-u (`import()` sa `webpackIgnore`), tako da bundler ne obrađuje WASM.
- **Koordinatni sistemi:** pdf.js `getViewport({ scale: 1 })` prostor je identičan MuPDF `page space` (top-left, rotacija primenjena). Svi rect-ovi se čuvaju u tom prostoru i direktno prosleđuju MuPDF `setRect`.

## Lokalni razvoj

```bash
npm install   # kopira WASM/worker fajlove u public/ (postinstall)
npm run dev   # http://localhost:3000
```

## Deploy na Vercel

```bash
npm i -g vercel
vercel        # ili poveži GitHub repo na vercel.com
```

- Nema potrebe za `vercel.json` — Vercel automatski detektuje Next.js.
- `npm run build` (sa `prebuild`) kopira WASM fajlove u `public/` i generiše statički
  export u `out/` (`output: "export"` u `next.config.ts`) — **bez serverless funkcija**.
- **AGPL §13:** javni deploy znači da se aplikacija servira preko mreže, pa moraš
  korisnicima ponuditi izvorni kod (link u footer-u i ovaj repo). Za ličnu/privatnu
  upotrebu bez toga — vidi sekciju Napomene.

## Napomene

- **Licenca:** Ovaj projekat je licenciran pod [AGPL-3.0-or-later](./LICENSE) (zbog MuPDF-a, koji je sam AGPL). Izvorni kod je javno dostupan na [github.com/modemanola/pdf-edit](https://github.com/modemanola/pdf-edit), a aplikacija tu vezu ističe i u svom footer-u (AGPL §13). Za zatvorenu/komercijalnu upotrebu bez obaveze objavljivanja koda potrebna je [komercijalna licenca od Artifex-a](https://artifex.com/contact/mupdf-js).
- Spisak svih biblioteka i njihovih licenci je u [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
- WASM je ~10 MB (ili ~3.6 MB uz brotli). Učitava se samo kada korisnik klikne „Ukloni označeni tekst".
- Skenirani PDF-ovi (bez tekstualnog sloja) nemaju tekst za selekciju — za njih bi bio potreban OCR.

## Struktura

```
app/            # Next.js App Router (page, layout, css)
components/     # PageCanvas (render + interakcija)
lib/            # pdf.ts (pdf.js), redact.ts (MuPDF), types.ts
public/mupdf/   # MuPDF WASM (kopiran iz node_modules)
scripts/        # copy-assets.mjs (postinstall/prebuild)
```

## Kontakt

- **Mejl:** [samolagano73@gmail.com](mailto:samolagano73@gmail.com)
