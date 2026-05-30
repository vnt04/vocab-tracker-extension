// ============================================================================
// test/setup.ts
// Global test setup. Saving now flows content-script -> background worker via
// chrome.runtime.sendMessage, so we mock chrome.runtime with an in-memory
// stand-in for the background worker that mirrors the server's case-insensitive
// upsert. Tests can override per-call with sendMessageMock.mockResolvedValueOnce
// / mockRejectedValueOnce. Reset between tests via resetChromeStorage().
// ============================================================================
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import type { SaveResult, VocabularyItem } from '../src/storage/types';

let items: VocabularyItem[] = [];
let idCounter = 0;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Mirrors the server contract so end-to-end (saveOrIncrement -> worker) tests pass.
function handleSave(text: string): SaveResult {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) {
    return { status: 'invalid', reason: 'empty' };
  }
  if (cleaned.length > 50) {
    return { status: 'invalid', reason: 'too_long' };
  }
  const key = normalize(cleaned);
  const existing = items.find((it) => normalize(it.text) === key);
  if (!existing) {
    const item: VocabularyItem = {
      id: `test-uuid-${++idCounter}`,
      text: cleaned,
      count: 1,
      notes: '',
    };
    items = [...items, item];
    return { status: 'created', item };
  }
  const updated: VocabularyItem = { ...existing, count: existing.count + 1 };
  items = items.map((it) => (it === existing ? updated : it));
  return { status: 'incremented', item: updated };
}

type Message = { type: 'VOCAB_SAVE'; text: string } | { type: 'VOCAB_LIST' };

function defaultImpl(message: Message): Promise<unknown> {
  if (message.type === 'VOCAB_SAVE') {
    return Promise.resolve(handleSave(message.text));
  }
  if (message.type === 'VOCAB_LIST') {
    return Promise.resolve([...items]);
  }
  return Promise.resolve(undefined);
}

const sendMessage = vi.fn(defaultImpl);
const chromeMock = { runtime: { sendMessage } };
(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

/** The mocked chrome.runtime.sendMessage (assert calls / override per test). */
export const sendMessageMock = sendMessage;

/** Reset the simulated worker state and mock behavior between tests. */
export function resetChromeStorage(): void {
  items = [];
  idCounter = 0;
  sendMessage.mockReset();
  sendMessage.mockImplementation(defaultImpl);
}

/** Read the current simulated-worker items (test inspection helper). */
export function readItems(): VocabularyItem[] {
  return [...items];
}
