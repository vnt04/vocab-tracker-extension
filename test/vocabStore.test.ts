// ============================================================================
// test/vocabStore.test.ts
// vocabStore is now a thin client over the background worker. These tests cover
// the CLIENT responsibilities: local validation short-circuits, forwarding the
// cleaned text, returning the worker's reply, and error handling. (The actual
// dedup/count now lives on the server; see test/vocabApi.test.ts for the mapping.)
// ============================================================================
import { beforeEach, describe, expect, it } from 'vitest';
import { getAll, normalizeText, saveOrIncrement } from '../src/storage/vocabStore';
import { readItems, resetChromeStorage, sendMessageMock } from './setup';

beforeEach(() => {
  resetChromeStorage();
});

describe('normalizeText', () => {
  it('trims, collapses internal whitespace, and lowercases', () => {
    expect(normalizeText('  Hello   World  ')).toBe('hello world');
  });

  it('treats different casings as equal', () => {
    expect(normalizeText('OVERWHELMED')).toBe(normalizeText('overwhelmed'));
  });
});

describe('saveOrIncrement — client validation (no round trip)', () => {
  it('rejects empty text without messaging the worker', async () => {
    const result = await saveOrIncrement('   ');
    expect(result).toEqual({ status: 'invalid', reason: 'empty' });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('rejects text longer than 50 chars without messaging the worker', async () => {
    const result = await saveOrIncrement('a'.repeat(51));
    expect(result).toEqual({ status: 'invalid', reason: 'too_long' });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('accepts text exactly 50 characters long', async () => {
    const result = await saveOrIncrement('a'.repeat(50));
    expect(result.status).toBe('created');
  });
});

describe('saveOrIncrement — forwards to the worker', () => {
  it('sends the cleaned (trimmed/whitespace-collapsed) text', async () => {
    await saveOrIncrement('  Give   Up  ');
    expect(sendMessageMock).toHaveBeenCalledWith({ type: 'VOCAB_SAVE', text: 'Give Up' });
  });

  it('creates then increments on a case-insensitive match (server semantics)', async () => {
    expect((await saveOrIncrement('Overwhelmed')).status).toBe('created');

    const second = await saveOrIncrement('overwhelmed');
    expect(second.status).toBe('incremented');
    if (second.status === 'incremented') {
      expect(second.item.count).toBe(2);
    }
    expect(readItems()).toHaveLength(1);
  });

  it('returns the worker reply verbatim', async () => {
    const item = { id: 'x', text: 'hello', count: 1, notes: '' };
    sendMessageMock.mockResolvedValueOnce({ status: 'created', item });
    const result = await saveOrIncrement('hello');
    expect(result).toEqual({ status: 'created', item });
  });
});

describe('saveOrIncrement — error path', () => {
  it('returns a structured error when messaging rejects', async () => {
    sendMessageMock.mockRejectedValueOnce(new Error('worker gone'));
    const result = await saveOrIncrement('hello');
    expect(result).toEqual({ status: 'error', message: 'worker gone' });
  });

  it('returns an error when the worker gives no response', async () => {
    sendMessageMock.mockResolvedValueOnce(undefined);
    const result = await saveOrIncrement('hello');
    expect(result.status).toBe('error');
  });
});

describe('getAll', () => {
  it('returns the list from the worker', async () => {
    await saveOrIncrement('one');
    await saveOrIncrement('two');
    expect(await getAll()).toHaveLength(2);
  });

  it('returns [] when messaging throws', async () => {
    sendMessageMock.mockRejectedValueOnce(new Error('boom'));
    expect(await getAll()).toEqual([]);
  });

  it('returns [] when the reply is not an array', async () => {
    sendMessageMock.mockResolvedValueOnce('corrupt');
    expect(await getAll()).toEqual([]);
  });
});
