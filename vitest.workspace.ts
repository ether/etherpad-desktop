import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'main',
      environment: 'node',
      include: ['tests/main/**/*.spec.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'renderer',
      environment: 'jsdom',
      include: ['tests/renderer/**/*.spec.{ts,tsx}'],
      setupFiles: ['tests/renderer/setup.ts'],
    },
  },
]);
