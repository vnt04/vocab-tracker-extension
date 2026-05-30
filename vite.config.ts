import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

// @crxjs derives every entry (content script, its dynamic imports,
// web_accessible_resources) from the manifest. Do NOT add
// rollupOptions.input for the content script — doing so causes
// duplicate / drifting bundles.
export default defineConfig({
  plugins: [react(), crx({ manifest, browser: 'chrome' })],
  build: { outDir: 'dist' },
});
