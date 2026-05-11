#!/usr/bin/env node
/**
 * One-time fetch + install of Etherpad source so the desktop's
 * embedded-server module has something to spawn locally.
 *
 *  - Downloads the GitHub source tarball for the pinned version below.
 *  - Extracts into `packages/desktop/resources/etherpad/` (gitignored).
 *  - Runs `pnpm install --prod` inside `src/` so Etherpad's runtime deps
 *    are ready.
 *  - Writes a `.installed-version` marker so re-runs are no-ops unless
 *    `--force` is passed or the pinned version changes.
 *
 * Idempotent. Safe to invoke from CI or as a postinstall step. Skips work
 * when the marker matches.
 *
 * Uses system `tar` (available on Linux / macOS / Windows 10+) so no new
 * npm dependency is needed.
 *
 * Future: a CI step before `electron-builder` will run this so the
 * shipping installer contains Etherpad pre-installed. For now it's a
 * dev-machine prerequisite for the embedded-server flow.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm, stat, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const ETHERPAD_VERSION = 'v2.7.3';
const TARBALL_URL = `https://github.com/ether/etherpad-lite/archive/refs/tags/${ETHERPAD_VERSION}.tar.gz`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCES = resolve(__dirname, '..', 'resources');
const TARGET = join(RESOURCES, 'etherpad');
const TARBALL = join(RESOURCES, `etherpad-${ETHERPAD_VERSION}.tar.gz`);
const VERSION_MARKER = join(TARGET, '.installed-version');

const FORCE = process.argv.includes('--force');

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function run(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
    child.on('error', rejectP);
  });
}

async function main() {
  if (!FORCE && await exists(VERSION_MARKER)) {
    const installed = (await readFile(VERSION_MARKER, 'utf8')).trim();
    if (installed === ETHERPAD_VERSION) {
      console.log(`[fetch-etherpad] Already on ${ETHERPAD_VERSION}, skipping (use --force to refetch).`);
      return;
    }
    console.log(`[fetch-etherpad] Marker says ${installed}, target is ${ETHERPAD_VERSION} — refetching.`);
  }

  await mkdir(RESOURCES, { recursive: true });
  console.log(`[fetch-etherpad] Downloading ${TARBALL_URL}`);
  const res = await fetch(TARBALL_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  await pipeline(res.body, createWriteStream(TARBALL));

  if (await exists(TARGET)) await rm(TARGET, { recursive: true, force: true });
  console.log('[fetch-etherpad] Extracting');
  await run('tar', ['-xzf', TARBALL, '-C', RESOURCES]);

  // The tarball extracts to `etherpad-<version-without-v>` — rename to `etherpad`.
  const semver = ETHERPAD_VERSION.startsWith('v') ? ETHERPAD_VERSION.slice(1) : ETHERPAD_VERSION;
  const extractedDir = join(RESOURCES, `etherpad-${semver}`);
  if (!(await exists(extractedDir))) {
    throw new Error(`expected ${extractedDir} after extract`);
  }
  await rename(extractedDir, TARGET);

  console.log('[fetch-etherpad] Installing Etherpad runtime deps (pnpm install in src/)');
  await run('pnpm', ['install', '--prod', '--no-frozen-lockfile'], { cwd: join(TARGET, 'src') });

  await writeFile(VERSION_MARKER, `${ETHERPAD_VERSION}\n`);
  await rm(TARBALL, { force: true });
  console.log(`[fetch-etherpad] Done — Etherpad ${ETHERPAD_VERSION} installed at ${TARGET}`);
}

main().catch((err) => {
  console.error('[fetch-etherpad] failed:', err.message);
  process.exit(1);
});
