# Third-Party Notices

Ovaj projekat (`pdf-edit`) koristi sledeće softverske komponente trećih strana.
Svaka je ovde navedena zajedno sa licencom pod kojom se distribuira, kako to
te licence zahtevaju.

Sam projekat je licenciran pod **AGPL-3.0-or-later** (videti `LICENSE`).

## MuPDF.js (mupdf)

- **Verzija:** 1.28.0
- **Autor/Nosilac autorskih prava:** Artifex Software, Inc.
- **Licenca:** AGPL-3.0-or-later
- **Sajt:** https://mupdf.com
- **Napomena:** MuPDF se koristi kao WebAssembly u `public/mupdf/`.
  Puna AGPL licenca je u `LICENSE`, a kopija se distribuira i uz WASM
  fajlove u `public/mupdf/LICENSE.mupdf.txt`.

## PDF.js (pdfjs-dist)

- **Verzija:** 6.2.108
- **Autor/Nosilac autorskih prava:** Mozilla Foundation i saradnici
- **Licenca:** Apache-2.0
- **Sajt:** https://mozilla.github.io/pdf.js/
- **Napomena:** pdf.js se distribuira kao worker fajl (`public/pdf.worker.min.mjs`,
  koji već sadrži Apache-2.0 obaveštenje) i bundle-ovan u klijentski kod.
  Pun tekst Apache-2.0 licence je u `public/pdfjs-LICENSE.txt`
  (kopiran iz `node_modules/pdfjs-dist/LICENSE`).

## MIT licencirane komponente

Sledeće komponente su pod **MIT** licencom. Njihov kod se bundle-uje u
aplikaciju, pa se ovde reprodukuje puno MIT obaveštenje sa odgovarajućim
nosiocima autorskih prava.

### Next.js — verzija 16.3.1

Copyright (c) 2025 Vercel, Inc.

### React / React DOM — verzija 19.2.8

Copyright (c) Meta Platforms, Inc. and affiliates.

### ESLint — verzija 9.39.x

Copyright OpenJS Foundation and other contributors, <www.openjsf.org>

### eslint-config-next — verzija 16.3.1

Copyright (c) 2025 Vercel, Inc.

### @types/* (DefinitelyTyped)

Copyright (c) Microsoft Corporation i saradnici DefinitelyTyped projekta.

---

MIT License (zajednički tekst za sve gore navedene):

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## TypeScript

- **Verzija:** 5.9.x
- **Autor/Nosilac autorskih prava:** Microsoft Corporation
- **Licenca:** Apache-2.0
- **Napomena:** TypeScript je isključivo build-time alat (prevodi TypeScript u
  JavaScript) i **ne distribuira se** kao deo aplikacije, pa njegova licenca ne
  nameće obaveze pri distribuciji ove aplikacije. Naveden je radi potpunosti.

---

Sve ostale datoteke u ovom repozitorijumu (osim gore navedenih delova trećih
strana) licencirane su pod GNU Affero General Public License v3.0 ili novijom
(`AGPL-3.0-or-later`). Videti `LICENSE`.
