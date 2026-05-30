# Vocabulary Tracker

A minimal **Chrome Extension (Manifest V3)** that lets you quickly save English
words and phrases you forget while reading the web. No accounts, no backend, no
cloud sync — everything is stored locally in your browser.

## What it does

Two behaviors, nothing more:

1. **Click a word** — click a single English word on any page and a small
   floating popup appears near the click with one **Save** button.
2. **Select text** — highlight any text and the same floating popup appears near
   the selection.

Click **Save** and the button changes to **Saved**, then the popup auto-closes
after ~900 ms.

The popup is rendered inside a **Shadow DOM** container, so page CSS can't break
it and its styles can't leak into the page.

### Data model

Each saved entry is exactly four fields — nothing else is stored (no URL, no
timestamp, no surrounding sentence, no history):

```ts
interface VocabularyItem {
  id: string;     // crypto.randomUUID(), generated only when first created
  text: string;   // trimmed text, internal whitespace collapsed, casing preserved
  count: number;  // starts at 1, +1 each time you save the same word/phrase again
  notes: string;  // always '' on create; never changed by saving
}
```

### Save rules

- Duplicate detection is **case-insensitive** (`Overwhelmed` == `overwhelmed` ==
  `OVERWHELMED`). A repeat save increments `count` and keeps the originally
  stored casing and notes.
- Empty text is never saved.
- Text longer than **50 characters** (after trimming) is never saved.
- Whitespace is trimmed and collapsed before saving and before comparing.

### What's intentionally ignored

- Clicks on/inside `input`, `textarea`, `button`, `select`, and editable
  (`contenteditable`) elements — no popup there.
- Links: clicking an anchor still navigates normally; the popup never hijacks it.

## Tech stack

- Chrome Extension Manifest V3
- TypeScript + React 19
- Vite 6 with [`@crxjs/vite-plugin`](https://crxjs.dev/) for MV3 manifest
  emission, content-script bundling, and HMR
- Storage: a public REST backend (`https://assistant.nghiepdev.info/api`). The
  content script messages a background service worker, which performs the
  cross-origin `fetch` (granted by `host_permissions`)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm

## Local development

```bash
npm install
npm run dev
```

`npm run dev` starts Vite with HMR. For live extension development, load the
generated `dist/` folder as an unpacked extension (see below) — `@crxjs` writes
the dev build there and hot-reloads the content script as you edit.

## Production build

```bash
npm run build
```

This type-checks the project and writes the packaged extension to **`dist/`**.

## Tests

```bash
npm test            # run the unit + integration suite once (Vitest)
npm run test:watch  # watch mode
npm run test:coverage  # run with a V8 coverage report (80% threshold enforced)
```

Tests run under **Vitest** with the **jsdom** environment. `chrome.runtime`
messaging is replaced by a small in-memory stand-in for the background worker
(see `test/setup.ts`) and `fetch` is mocked, so no browser or network is
required. Coverage covers the client gateway + validation (`vocabStore.ts`), the
HTTP↔result mapping (`vocabApi.ts`), selection capture + target guards
(`selection.ts`), word-under-click detection (`wordDetection.ts`), the
Save/Saved popup component (`SavePopup.tsx`), and the Shadow-DOM mount lifecycle
(`mountPopup.ts`).

## Load the unpacked extension into Chrome

1. Run `npm run build` so the **`dist/`** folder exists.
2. Open Chrome and go to **`chrome://extensions`**.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the **`dist/`** folder produced by the build.
6. Open any web page, then **click a word** or **select some text** — the
   floating **Save** button appears. Click it to save.

To pick up changes after editing, re-run `npm run build` (or keep `npm run dev`
running) and click the **reload** icon on the extension card in
`chrome://extensions`.

## How it works

- **`manifest.config.ts`** is the single source of truth for the MV3 manifest.
  It registers one content script entry, `src/content/index.tsx`, matched
  against `<all_urls>` at `document_idle`.
- The **content script** attaches a single passive `mouseup` listener. It only
  *reads* the page — it never calls `preventDefault` / `stopPropagation` on page
  events, so link navigation, form controls, and native text selection keep
  working.
  - If there's a non-collapsed **selection**, it uses that text.
  - Otherwise it detects the **single word under the click** using
    `caretPositionFromPoint` / `caretRangeFromPoint` plus a Unicode-aware
    `Intl.Segmenter`.
- The popup is mounted once into a **Shadow DOM** host; its CSS is imported as a
  string (`./popup.css?inline`) and injected into the shadow root, never into the
  page or the manifest.
- On Save the content script validates locally (non-empty, ≤ 50 chars, trimmed)
  then sends the word to the **background service worker**
  (`src/background/index.ts`), which `POST`s it to the API through
  `src/api/vocabApi.ts`. The **server** owns the case-insensitive dedup + count;
  routing through the worker is what lets the cross-origin `fetch` bypass page CORS.

## Notes

- **Permissions:** no `storage` permission is needed (data lives on the server).
  The only host permission is
  `host_permissions: ["https://assistant.nghiepdev.info/*"]`, which lets the
  background service worker `fetch` the API without being blocked by page CORS.
  `<all_urls>` in `content_scripts.matches` is just the injection match pattern.
- A **background service worker** (`src/background/index.ts`) performs all
  network calls. There is **no browser-action popup**; `index.html` exists only
  to give `vite dev` a root document and is not referenced by the manifest.
