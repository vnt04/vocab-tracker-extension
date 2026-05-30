// ============================================================================
// src/content/selection.ts
// Selection capture + target guards + popup positioning helpers.
// No event listeners registered here.
// ============================================================================

export interface Trigger {
  text: string;
  rect: DOMRect;
}

// Form controls + editable surfaces where we must never show the popup.
// contenteditable="false" is intentionally excluded (it is NOT editable).
const IGNORE_SELECTOR =
  'input, textarea, select, button, [contenteditable=""], [contenteditable="true"]';

const MAX_Z_INDEX = 2147483647;
const GAP = 6; // px between the anchor rect and the popup

/** trim + collapse internal whitespace (casing preserved). */
function collapseWs(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Resolve an EventTarget to the nearest Element we can run `.closest()` on. */
function toElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Node && target.parentElement) {
    return target.parentElement;
  }
  return null;
}

/**
 * Active non-collapsed selection -> {text: collapsed-whitespace string, rect: union
 * getBoundingClientRect}. null when no selection, collapsed, empty after collapse,
 * or zero-size rect.
 */
export function getSelectionTrigger(): Trigger | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const text = collapseWs(selection.toString());
  if (text.length === 0) {
    return null;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return { text, rect };
}

/**
 * true when target is inside input, textarea, select, button, or
 * contenteditable="" / "true" (NOT contenteditable="false").
 */
export function isIgnoredTarget(target: EventTarget | null): boolean {
  const element = toElement(target);
  return element != null && element.closest(IGNORE_SELECTOR) != null;
}

/**
 * Position a fixed-position host below-left of rect (flip up on bottom overflow),
 * clamp X/Y into the viewport, set zIndex MAX. rect is viewport-relative =>
 * position:fixed, NEVER add scrollX/scrollY.
 */
export function positionPopup(host: HTMLElement, rect: DOMRect): void {
  host.style.position = 'fixed';
  host.style.zIndex = String(MAX_Z_INDEX);

  // Measure the popup so we can clamp it fully on-screen.
  const popupRect = host.getBoundingClientRect();
  const popupWidth = popupRect.width || 0;
  const popupHeight = popupRect.height || 0;

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  // Default: below-left aligned to the anchor's left edge.
  let top = rect.bottom + GAP;
  let left = rect.left;

  // Flip up if the popup would overflow the bottom edge.
  if (top + popupHeight > viewportHeight) {
    top = rect.top - GAP - popupHeight;
  }

  // Clamp into the viewport (keep a small margin so it never sits flush off-edge).
  const maxLeft = Math.max(0, viewportWidth - popupWidth);
  const maxTop = Math.max(0, viewportHeight - popupHeight);
  left = Math.min(Math.max(0, left), maxLeft);
  top = Math.min(Math.max(0, top), maxTop);

  host.style.left = `${Math.round(left)}px`;
  host.style.top = `${Math.round(top)}px`;
}
