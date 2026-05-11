import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const sharedResolve = {
  alias: { '@shared': resolve('../shell/src') },
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    globals: true,
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: 'main',
          globals: true,
          environment: 'node',
          include: ['tests/main/**/*.spec.ts'],
        },
      },
    ],
  },
});
