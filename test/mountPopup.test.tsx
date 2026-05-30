// ============================================================================
// test/mountPopup.test.tsx
// Integration tests for the Shadow-DOM single-instance popup manager. jsdom
// supports attachShadow + React createRoot, so we can assert the host lifecycle.
// The Vite-only `popup.css?inline` import is mocked to a plain string.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetChromeStorage } from './setup';

// Mock the Vite `?inline` CSS import (no Vite transform in the test runner).
vi.mock('../src/content/popup.css?inline', () => ({ default: '.vt-popup{}' }));

import { mountPopup, unmountPopup } from '../src/content/mountPopup';

const HOST_ID = 'vocab-tracker-host';
const rect = new DOMRect(10, 10, 20, 10);

beforeEach(() => {
  resetChromeStorage();
  document.body.innerHTML = '';
  // Give the host measurable dimensions for positionPopup.
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);
});

afterEach(() => {
  unmountPopup();
  vi.restoreAllMocks();
});

describe('mountPopup', () => {
  it('creates a single shadow-host containing the Save button', async () => {
    mountPopup('hello', rect);

    const host = document.getElementById(HOST_ID);
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).not.toBeNull();

    // React renders asynchronously; wait for the button to appear in the shadow root.
    await vi.waitFor(() => {
      const button = host?.shadowRoot?.querySelector('button');
      expect(button?.textContent).toBe('Save');
    });

    // Style is injected into the shadow root, not the page.
    expect(host?.shadowRoot?.querySelector('style')).not.toBeNull();
    expect(host?.style.position).toBe('fixed');
  });

  it('reuses the same host when called twice (single instance)', async () => {
    mountPopup('first', rect);
    const firstHost = document.getElementById(HOST_ID);

    mountPopup('second', rect);
    const hosts = document.querySelectorAll(`#${HOST_ID}`);

    expect(hosts).toHaveLength(1);
    expect(document.getElementById(HOST_ID)).toBe(firstHost);
  });

  it('removes the host on unmount', async () => {
    mountPopup('hello', rect);
    expect(document.getElementById(HOST_ID)).not.toBeNull();

    unmountPopup();
    expect(document.getElementById(HOST_ID)).toBeNull();
  });

  it('unmountPopup is a no-op when nothing is mounted', () => {
    expect(() => unmountPopup()).not.toThrow();
    expect(document.getElementById(HOST_ID)).toBeNull();
  });

  it('degrades gracefully when document.body is unavailable', () => {
    const original = document.body;
    Object.defineProperty(document, 'body', {
      configurable: true,
      get: () => null,
    });

    expect(() => mountPopup('hello', rect)).not.toThrow();
    expect(document.getElementById(HOST_ID)).toBeNull();

    Object.defineProperty(document, 'body', {
      configurable: true,
      get: () => original,
    });
  });
});
