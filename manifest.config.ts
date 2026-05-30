import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// Single source of truth for the MV3 manifest.
// - The content_scripts js entry path MUST match src/content/index.tsx byte-for-byte.
// - NO `css` key: popup styles are imported via './popup.css?inline' and injected
//   into the shadow root by mountPopup.ts, preserving Shadow DOM isolation.
// - Saving now goes through the server. The content script messages the background
//   service worker, which performs the cross-origin fetch; host_permissions grant
//   that fetch access without the visited page's CORS policy blocking it.
//   No "storage" permission is needed anymore (persistence is server-side).
export default defineManifest({
  manifest_version: 3,
  name: 'Vocabulary Tracker',
  description: 'Save English words and phrases you forget while reading the web.',
  version: pkg.version,
  host_permissions: ['https://assistant.nghiepdev.info/*'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
});
