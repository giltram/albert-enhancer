import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // WXT's content-script context reads Vite's import.meta.env at module load.
    server: { deps: { inline: ['wxt'] } },
  },
});
