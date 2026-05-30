// ============================================================================
// src/content/index.tsx
// Content-script ENTRY (declared in manifest.config.ts).
// A single passive 'mouseup' capture listener shows the Save popup ONLY for a
// non-collapsed text SELECTION (highlighted text). It only READS — never
// preventDefault/stopPropagation on page events — so link navigation, form
// controls, and native selection are never hijacked. (Single-word click capture
// was intentionally removed: the popup appears for highlighted text only.)
// ============================================================================
import { getSelectionTrigger, isIgnoredTarget } from './selection';
import { mountPopup, unmountPopup } from './mountPopup';

const HOST_ID = 'vocab-tracker-host';

function handleMouseUp(): void {
  // Read after the browser commits the final selection.
  requestAnimationFrame(() => {
    const selection = getSelectionTrigger();
    if (!selection) {
      return;
    }

    // Suppress when either end of the selection lives in an ignored element
    // (input/textarea/select/button/contenteditable).
    const range = window.getSelection();
    if (
      range &&
      (isIgnoredTarget(range.anchorNode) || isIgnoredTarget(range.focusNode))
    ) {
      return;
    }

    mountPopup(selection.text, selection.rect);
  });
}

function handleMouseDown(event: MouseEvent): void {
  // Close the popup when clicking outside our host (clicks inside the shadow
  // host retarget to the host element, so this comparison stays accurate).
  const target = event.target;
  if (target instanceof Element && target.closest(`#${HOST_ID}`)) {
    return;
  }
  unmountPopup();
}

// Passive + capture: we only observe, never block the page.
document.addEventListener('mouseup', handleMouseUp, { capture: true, passive: true });
document.addEventListener('mousedown', handleMouseDown, { capture: true, passive: true });
