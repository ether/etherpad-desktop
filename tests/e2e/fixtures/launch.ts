import { _electron } from 'playwright-core';
import type { ElectronApplication, Page } from 'playwright-core';
import { resolve } from 'node:path';
import { freshUserDataDir } from './userData.js';

export type AppHandle = {
  app: ElectronApplication;
  shell: Page;
  userDataDir: string;
  close: () => Promise<void>;
};

const MAIN_PATH = resolve(new URL('../../../out/main/index.cjs', import.meta.url).pathname);

export async function launchApp(opts?: { userDataDir?: string }): Promise<AppHandle> {
  const { dir, cleanup } = opts?.userDataDir
    ? { dir: opts.userDataDir, cleanup: () => {} }
    : freshUserDataDir();

  const app = await _electron.launch({
    args: [MAIN_PATH, `--user-data-dir=${dir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  const shell = await app.firstWindow();

  return {
    app,
    shell,
    userDataDir: dir,
    close: async () => {
      await app.close();
      cleanup();
    },
  };
}
