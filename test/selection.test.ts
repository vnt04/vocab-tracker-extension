// ============================================================================
// test/selection.test.ts
// Unit tests for selection capture, target guards, and popup positioning.
// ============================================================================
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSelectionTrigger,
  isIgnoredTarget,
  positionPopup,
} from '../src/content/selection';

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

/**
 * Build a non-collapsed selection over an element's text and stub its rect.
 * jsdom does not implement Range.getBoundingClientRect, so we assign it directly
 * (spyOn cannot wrap a method that does not exist on the prototype).
 */
function selectText(el: HTMLElement, rect: Partial<DOMRect>): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('getSelectionTrigger', () => {
  it('returns null when there is no selection', () => {
    window.getSelection()?.removeAllRanges();
    expect(getSelectionTrigger()).toBeNull();
  });

  it('returns the collapsed-whitespace text and a rect for a real selection', () => {
    const p = document.createElement('p');
    p.textContent = '  hello   world  ';
    document.body.appendChild(p);
    selectText(p, { left: 10, top: 20, bottom: 32, width: 80, height: 12 });

    const trigger = getSelectionTrigger();
    expect(trigger).not.toBeNull();
    expect(trigger?.text).toBe('hello world');
    expect(trigger?.rect.left).toBe(10);
  });

  it('returns null when the selection collapses to empty text', () => {
    const p = document.createElement('p');
    p.textContent = '    ';
    document.body.appendChild(p);
    selectText(p, { width: 0, height: 0 });
    expect(getSelectionTrigger()).toBeNull();
  });

  it('returns null when the selection rect has zero size', () => {
    const p = document.createElement('p');
    p.textContent = 'text';
    document.body.appendChild(p);
    selectText(p, { width: 0, height: 0 });
    expect(getSelectionTrigger()).toBeNull();
  });
});

describe('isIgnoredTarget', () => {
  it.each(['input', 'textarea', 'select', 'button'])(
    'ignores <%s> elements',
    (tag) => {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      expect(isIgnoredTarget(el)).toBe(true);
    },
  );

  it('ignores contenteditable="true" and contenteditable=""', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    expect(isIgnoredTarget(editable)).toBe(true);

    const emptyEditable = document.createElement('div');
    emptyEditable.setAttribute('contenteditable', '');
    document.body.appendChild(emptyEditable);
    expect(isIgnoredTarget(emptyEditable)).toBe(true);
  });

  it('does NOT ignore contenteditable="false"', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'false');
    document.body.appendChild(el);
    expect(isIgnoredTarget(el)).toBe(false);
  });

  it('resolves a text node to its parent element before matching', () => {
    const input = document.createElement('input');
    input.value = 'x';
    document.body.appendChild(input);
    const span = document.createElement('span');
    span.textContent = 'plain';
    document.body.appendChild(span);
    expect(isIgnoredTarget(span.firstChild)).toBe(false);
  });

  it('returns false for a plain paragraph and for null', () => {
    const p = document.createElement('p');
    document.body.appendChild(p);
    expect(isIgnoredTarget(p)).toBe(false);
    expect(isIgnoredTarget(null)).toBe(false);
  });
});

describe('positionPopup', () => {
  it('positions the host below-left of the anchor with fixed positioning and max z-index', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      width: 60,
      height: 30,
    } as DOMRect);
    // jsdom reports 0 for clientWidth/clientHeight; stub a real viewport so the
    // clamp math does not collapse the position to (0, 0).
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);

    const anchor = new DOMRect(100, 100, 50, 20);
    positionPopup(host, anchor);

    expect(host.style.position).toBe('fixed');
    expect(host.style.zIndex).toBe('2147483647');
    expect(host.style.left).toBe('100px');
    // bottom (120) + GAP (6) = 126
    expect(host.style.top).toBe('126px');
  });

  it('flips above the anchor when it would overflow the bottom edge', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      width: 60,
      height: 30,
    } as DOMRect);
    // Force a short viewport so the below position overflows.
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(140);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);

    const anchor = new DOMRect(100, 120, 50, 20); // bottom = 140
    positionPopup(host, anchor);
    // flips up: top(120) - GAP(6) - height(30) = 84
    expect(host.style.top).toBe('84px');
  });

  it('clamps the host into the viewport when the anchor is off-edge', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      width: 60,
      height: 30,
    } as DOMRect);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(200);

    const anchor = new DOMRect(500, 500, 10, 10);
    positionPopup(host, anchor);
    // left clamped to viewportWidth - popupWidth = 200 - 60 = 140
    expect(host.style.left).toBe('140px');
    // top clamped to viewportHeight - popupHeight = 200 - 30 = 170
    expect(host.style.top).toBe('170px');
  });
});
