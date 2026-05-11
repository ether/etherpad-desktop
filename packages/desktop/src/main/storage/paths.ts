import { join } from 'node:path';

export type Paths = {
  base: string;
  workspacesFile: string;
  padHistoryFile: string;
  settingsFile: string;
  windowStateFile: string;
  padCacheDir: string;
  logsDir: string;
};

export function paths(base: string): Paths {
  return {
    base,
    workspacesFile: join(base, 'workspaces.json'),
    padHistoryFile: join(base, 'pad-history.json'),
    settingsFile: join(base, 'settings.json'),
    windowStateFile: join(base, 'window-state.json'),
    padCacheDir: join(base, 'pad-cache'),
    logsDir: join(base, 'logs'),
  };
}
