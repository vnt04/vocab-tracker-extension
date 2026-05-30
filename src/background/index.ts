// ============================================================================
// src/background/index.ts
// MV3 background service worker — the ONLY context that touches the network.
// Content scripts forward save/list requests here via chrome.runtime.sendMessage
// so the cross-origin fetch runs with host_permissions and is not blocked by the
// visited page's CORS policy. Always returns `true` for async handlers so the
// message channel stays open until sendResponse fires.
// ============================================================================
import { listVocab, saveVocab } from '../api/vocabApi';
import type { SaveResult, VocabularyItem } from '../storage/types';

export type VocabRequest =
  | { type: 'VOCAB_SAVE'; text: string }
  | { type: 'VOCAB_LIST' };

chrome.runtime.onMessage.addListener(
  (message: VocabRequest, _sender, sendResponse): boolean => {
    if (message?.type === 'VOCAB_SAVE') {
      saveVocab(message.text).then(sendResponse, (error: unknown) => {
        const result: SaveResult = {
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        };
        sendResponse(result);
      });
      return true; // keep the channel open for the async sendResponse
    }

    if (message?.type === 'VOCAB_LIST') {
      listVocab().then(sendResponse, () => sendResponse([] as VocabularyItem[]));
      return true;
    }

    return false;
  },
);
