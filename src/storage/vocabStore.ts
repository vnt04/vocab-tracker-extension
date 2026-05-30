// ============================================================================
// src/storage/vocabStore.ts
// Thin client gateway. Persistence now lives on the server; this module forwards
// saves/reads to the background service worker (the only context allowed to do
// cross-origin fetch) and returns its reply. Client-side validation short-circuits
// empty / too-long inputs BEFORE any round trip, preserving the existing
// SaveResult contract so SavePopup.tsx is unchanged.
// ============================================================================
import type { SaveResult, VocabularyItem } from './types';

const MAX_LEN = 50; // length check AFTER trim + whitespace collapse

/** trim + collapse internal whitespace + lowercase. For COMPARISON ONLY — never persisted. */
export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** trim + collapse internal whitespace (casing preserved). */
function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Fetch the saved list via the background worker. Returns [] on any failure. */
export async function getAll(): Promise<VocabularyItem[]> {
  try {
    const items = await chrome.runtime.sendMessage({ type: 'VOCAB_LIST' });
    return Array.isArray(items) ? (items as VocabularyItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Validate locally, then ask the background worker to POST the word to the server.
 *  - cleaned empty            -> { status: 'invalid', reason: 'empty' }    (no round trip)
 *  - cleaned.length > MAX_LEN -> { status: 'invalid', reason: 'too_long' } (no round trip)
 *  - otherwise                -> the server's reply, mapped to SaveResult
 *  - messaging fails          -> { status: 'error', message }
 */
export async function saveOrIncrement(text: string): Promise<SaveResult> {
  const cleaned = cleanText(text);

  if (cleaned.length === 0) {
    return { status: 'invalid', reason: 'empty' };
  }
  if (cleaned.length > MAX_LEN) {
    return { status: 'invalid', reason: 'too_long' };
  }

  try {
    const result = (await chrome.runtime.sendMessage({
      type: 'VOCAB_SAVE',
      text: cleaned,
    })) as SaveResult | undefined;

    if (result && typeof result === 'object' && 'status' in result) {
      return result;
    }
    return {
      status: 'error',
      message: 'No response from background service worker',
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
