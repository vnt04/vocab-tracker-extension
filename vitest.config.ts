import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest runs the source modules directly (no @crxjs manifest pipeline). We only
// load the React plugin so .tsx component tests transform correctly. jsdom gives
// us DOM/window so selection + word-detection + component code can run.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/storage/**/*.ts', 'src/content/**/*.{ts,tsx}'],
      // index.tsx only wires DOM listeners against real mouse events (integration
      // glue that needs a real browser); the testable units it composes are
      // covered directly. types.ts is type-only (no runtime code to execute).
      exclude: [
        'src/content/index.tsx',
        'src/storage/types.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
