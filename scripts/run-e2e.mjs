#!/usr/bin/env node
// Run Playwright E2E either under xvfb-run (if available) so the tests don't
// steal focus from the user, or directly otherwise. Pass-through args.
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function which(bin) {
  const r = spawnSync('which', [bin], { stdio: ['ignore', 'pipe', 'ignore'] });
  return r.status === 0 ? r.stdout.toString().trim() : null;
}

const xvfb = which('xvfb-run');
const playwrightArgs = ['exec', 'playwright', 'test', ...args];

let cmd;
let argv;
if (xvfb && !process.env.E2E_NO_XVFB) {
  cmd = xvfb;
  argv = ['--auto-servernum', '--server-args=-screen 0 1280x800x24', 'pnpm', ...playwrightArgs];
  console.error('[e2e] running under xvfb-run (set E2E_NO_XVFB=1 to disable)');
} else {
  cmd = 'pnpm';
  argv = playwrightArgs;
  if (!xvfb) {
    console.error('[e2e] xvfb-run not found on PATH; tests will run on the visible display.');
    console.error('[e2e] install with: sudo apt install xvfb');
  }
}

const r = spawnSync(cmd, argv, { stdio: 'inherit' });
process.exit(r.status ?? 1);
