import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const sharedResolve = {
  alias: { '@shared': resolve('../shell/src') },
};

export default defineConfig({
  plugins: [react()],
  resolve: sharedResolve,
  test: {
    globals: true,
    projects: [
      {
        plugins: [react()],
        resolve: sharedResolve,
        test: {
          name: 'main',
          globals: true,
          environment: 'node',
          include: ['tests/main/**/*.spec.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: sharedResolve,
        test: {
          name: 'renderer',
          globals: true,
          environment: 'jsdom',
          include: ['tests/renderer/**/*.spec.{ts,tsx}'],
          setupFiles: ['tests/renderer/setup.ts'],
        },
      },
    ],
  },
});
