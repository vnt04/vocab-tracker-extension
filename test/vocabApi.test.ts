// ============================================================================
// test/vocabApi.test.ts
// Tests the HTTP <-> SaveResult mapping for the backend client. Mocks global
// fetch so no real network call is made.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listVocab, saveVocab } from '../src/api/vocabApi';

const VOCAB_URL = 'https://assistant.nghiepdev.info/api/vocab';
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('saveVocab', () => {
  it('POSTs { text } to the vocab endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'created', item: { id: '1', text: 'hi', count: 1, notes: '' } }, true, 201),
    );
    await saveVocab('hi');
    expect(fetchMock).toHaveBeenCalledWith(
      VOCAB_URL,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'hi' }) }),
    );
  });

  it('maps created/incremented to the SaveResult success union', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'incremented', item: { id: '1', text: 'hi', count: 2, notes: '' } }),
    );
    const result = await saveVocab('hi');
    expect(result).toEqual({ status: 'incremented', item: { id: '1', text: 'hi', count: 2, notes: '' } });
  });

  it('maps a server validation reason to invalid', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'error', reason: 'too_long' }, false, 400));
    expect(await saveVocab('x')).toEqual({ status: 'invalid', reason: 'too_long' });
  });

  it('maps server_error to a structured error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'error', reason: 'server_error' }, false, 500));
    const result = await saveVocab('x');
    expect(result.status).toBe('error');
  });

  it('returns a structured error when fetch throws (offline)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await saveVocab('x')).toEqual({ status: 'error', message: 'offline' });
  });
});

describe('listVocab', () => {
  it('returns the array of items', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: '1', text: 'hi', count: 1, notes: '' }]));
    expect(await listVocab()).toHaveLength(1);
  });

  it('returns [] on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, false, 500));
    expect(await listVocab()).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await listVocab()).toEqual([]);
  });
});
