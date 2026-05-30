// ============================================================================
// src/content/mountPopup.ts
// Shadow-DOM single-instance popup manager. Owns the host div + React root
// lifecycle. Tears down/repositions any existing instance before showing a new
// one. CSS is injected into the shadow root (never the page's global scope).
// ============================================================================
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SavePopup from './SavePopup';
import { positionPopup } from './selection';
import popupCss from './popup.css?inline';

const HOST_ID = 'vocab-tracker-host';

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let root: Root | null = null;

/**
 * Build (once) the host div, its open shadow root, and inject scoped styles.
 * Returns null when there is no document.body to attach to (e.g. a page that
 * replaced document.body via document.open(), or a browser-internal page).
 */
function ensureHost(): { host: HTMLDivElement; root: Root } | null {
  if (host && shadow && root) {
    return { host, root };
  }

  // Cannot attach without a body; degrade gracefully instead of throwing.
  if (!document.body) {
    return null;
  }

  host = document.createElement('div');
  host.id = HOST_ID;
  // Neutralize inherited host-page layout so positioning is fully ours.
  host.style.all = 'initial';

  shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = popupCss;
  shadow.appendChild(style);

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  document.body.appendChild(host);
  root = createRoot(mountPoint);

  return { host, root };
}

/**
 * Show (or replace) the single popup: build/reuse one host div #vocab-tracker-host,
 * attachShadow({mode:'open'}), inject popupCss into a <style>, createRoot once,
 * render <SavePopup text rect onClose={unmountPopup}/>, then positionPopup(host, rect).
 */
export function mountPopup(text: string, rect: DOMRect): void {
  const instance = ensureHost();
  if (!instance) {
    return;
  }

  instance.root.render(
    createElement(SavePopup, { text, rect, onClose: unmountPopup }),
  );

  // Position after render so the host has measurable dimensions.
  positionPopup(instance.host, rect);
}

/** Unmount the React root, clear any pending auto-close timer, and remove the host. */
export function unmountPopup(): void {
  // Capture locals, then null ALL module-level state up front so any re-entrant
  // ensureHost() (e.g. a rapid mountPopup during the unmount tick) observes a
  // fully-cleared state and rebuilds cleanly rather than a half-torn-down host.
  const prevRoot = root;
  const prevHost = host;
  root = null;
  host = null;
  shadow = null;

  if (prevRoot) {
    // Unmounting runs SavePopup's cleanup effect, which clears its timer.
    prevRoot.unmount();
  }
  if (prevHost && prevHost.parentNode) {
    prevHost.parentNode.removeChild(prevHost);
  }
}
