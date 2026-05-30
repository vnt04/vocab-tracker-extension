// ============================================================================
// src/api/vocabApi.ts
// Client for the public Track-Vocabulary backend. This module runs INSIDE the
// background service worker — host_permissions grant it cross-origin fetch
// without being blocked by the visited page's CORS policy. The server owns the
// case-insensitive dedup + count, so this file only maps HTTP/JSON onto the
// existing SaveResult union.
// ============================================================================
import type { SaveResult, VocabularyItem } from '../storage/types';

const API_BASE = 'https://assistant.nghiepdev.info/api';
const VOCAB_URL = `${API_BASE}/vocab`;

// Shape returned by POST /api/vocab.
type ApiSaveResponse =
  | { status: 'created' | 'incremented'; item: VocabularyItem }
  | { status: 'error'; reason: 'empty' | 'too_long' | 'server_error' };

/** Runtime guard so a malformed payload can never masquerade as a VocabularyItem. */
function isItem(value: unknown): value is VocabularyItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.text === 'string' &&
    typeof v.count === 'number' &&
    typeof v.notes === 'string'
  );
}

/**
 * POST { text } and map the reply onto SaveResult:
 *  - 200/201 created|incremented + item -> { status, item }
 *  - 400 error reason empty|too_long     -> { status: 'invalid', reason }
 *  - 500 / unexpected / network failure  -> { status: 'error', message }
 */
export async function saveVocab(text: string): Promise<SaveResult> {
  try {
    const res = await fetch(VOCAB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json().catch(() => null)) as ApiSaveResponse | null;

    if (
      data &&
      (data.status === 'created' || data.status === 'incremented') &&
      isItem((data as { item?: unknown }).item)
    ) {
      return { status: data.status, item: data.item };
    }

    const reason = data && data.status === 'error' ? data.reason : undefined;
    if (reason === 'empty' || reason === 'too_long') {
      return { status: 'invalid', reason };
    }
    return { status: 'error', message: reason ?? `HTTP ${res.status}` };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** GET the saved list (server returns it sorted by count desc). [] on any failure. */
export async function listVocab(): Promise<VocabularyItem[]> {
  try {
    const res = await fetch(VOCAB_URL);
    if (!res.ok) {
      return [];
    }
    const data = (await res.json().catch(() => null)) as unknown;
    return Array.isArray(data) ? data.filter(isItem) : [];
  } catch {
    return [];
  }
}
