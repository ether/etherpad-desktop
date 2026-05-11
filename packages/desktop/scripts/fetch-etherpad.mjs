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

  // Slim Etherpad's deps before installing: we only ship the dirty-db
  // path, so SQL/NoSQL drivers + Swagger UI + Azure auth + OpenTelemetry
  // / Apache Arrow tooling are dead weight. Removing them at the
  // package.json level (vs after install) means pnpm never even
  // downloads them. Cuts the resulting install from ~300MB to ~50MB.
  //
  // Conservative list — only drivers + tools the embedded-server flow
  // demonstrably doesn't load. `ueberdb2` stays (the abstraction layer
  // `dirty` is dispatched through). `tsx` + `cross-env` stay (server
  // entry point). `socket.io` + `express` + standard libs stay.
  console.log('[fetch-etherpad] Slimming unused DB drivers + dev-only deps from Etherpad src/');
  await pruneUnusedDeps(join(TARGET, 'src'));

  // Drop documentation, packaging scripts, dev-only workspace packages
  // before install so pnpm doesn't pull their dev deps either.
  for (const sub of ['doc', 'docs', 'packaging', 'snap', 'docker-compose.yml', 'docker-compose.dev.yml', 'Dockerfile', 'admin', 'ui', 'tests', 'AGENTS.MD', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'best_practices.md', 'README.md']) {
    await rm(join(TARGET, sub), { recursive: true, force: true });
  }

  console.log('[fetch-etherpad] Installing Etherpad runtime deps (pnpm install in src/)');
  await run('pnpm', ['install', '--prod', '--no-frozen-lockfile'], { cwd: join(TARGET, 'src') });

  // Post-install: surgically delete .pnpm entries that ueberdb2 / Etherpad
  // pull in transitively but that the dirty-db embedded path never loads.
  // pnpm can't trim these via --filter / --no-optional because they're
  // bundled as direct deps of intermediate packages. Removing the .pnpm
  // store entry breaks `require('mongodb')` immediately, but the dirty
  // driver doesn't take that path.
  console.log('[fetch-etherpad] Post-install: pruning unused .pnpm store entries');
  // Etherpad is a pnpm workspace — node_modules/.pnpm lives at the
  // workspace root, not under src/.
  await prunePnpmStore(join(TARGET, 'node_modules', '.pnpm'));

  await writeFile(VERSION_MARKER, `${ETHERPAD_VERSION}\n`);
  await rm(TARBALL, { force: true });
  console.log(`[fetch-etherpad] Done — Etherpad ${ETHERPAD_VERSION} installed at ${TARGET}`);
}

const SLIM_REMOVE = [
  // SQL / NoSQL drivers not used when dbType: "dirty"
  '@elastic/elasticsearch',
  'cassandra-driver',
  'mongodb',
  'mysql2',
  'pg',
  'rethinkdb',
  'redis',
  'surrealdb',
  // Swagger UI — runtime serves API docs; not needed for embedded
  'swagger-ui-express',
  'swagger-jsdoc',
];

/**
 * Substrings matching .pnpm store directory names that the dirty-db
 * embedded path never loads. .pnpm dirs are formatted like
 * `<scope>+<pkg>@<version>...`, so the colon in scoped names becomes
 * `+` — match accordingly.
 *
 * Anything in here is verified safe to delete via the post-install
 * smoke test (`node --require tsx/cjs node/server.ts` → /api/ probe).
 * Add cautiously; verify before commit.
 */
const PNPM_PRUNE_PREFIXES = [
  // Cloud DB drivers (transitively via ueberdb2)
  '@elastic+',
  'cassandra-driver@',
  'mongodb@',
  'mongodb-',
  'mysql2@',
  'mysql@',
  'pg@',
  'pg-',
  'redis@',
  '@redis+',
  'rethinkdb@',
  'surrealdb@',
  'tedious@',
  // Cloud-DB heavy transitives
  'apache-arrow@',
  '@js-joda+',
  '@azure+',
  '@opentelemetry+',
  '@typespec+',
  // Swagger / API docs UI
  'swagger-ui-dist@',
  'swagger-jsdoc@',
  'swagger-ui-express@',
  // @types/* — TypeScript type defs, never require()d at runtime.
  '@types+',
  // Alternative ueberdb2 backends we don't use
  'rusty-store-kv-',
  // MongoDB leftovers (mongodb itself was pruned earlier)
  'bson@',
  // tsx (TypeScript loader) requires esbuild + typescript at runtime, so
  // they must stay even though they look like dev tools.
  // jsdom is used by Etherpad's ImportEtherpad — keep.
];

async function pruneUnusedDeps(pkgDir) {
  const pkgPath = join(pkgDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  let removed = 0;
  for (const name of SLIM_REMOVE) {
    if (pkg.dependencies?.[name]) {
      delete pkg.dependencies[name];
      removed += 1;
    }
    if (pkg.optionalDependencies?.[name]) {
      delete pkg.optionalDependencies[name];
      removed += 1;
    }
  }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2));
  console.log(`[fetch-etherpad]   pruned ${removed} entries from ${pkgDir}/package.json`);
}

async function prunePnpmStore(pnpmDir) {
  const { readdir } = await import('node:fs/promises');
  let entries;
  try {
    entries = await readdir(pnpmDir);
  } catch {
    console.warn(`[fetch-etherpad]   ${pnpmDir} missing; skipping store prune`);
    return;
  }
  let removedCount = 0;
  let removedBytes = 0;
  for (const entry of entries) {
    if (!PNPM_PRUNE_PREFIXES.some((p) => entry.startsWith(p))) continue;
    const full = join(pnpmDir, entry);
    try {
      const size = await dirSize(full);
      await rm(full, { recursive: true, force: true });
      removedCount += 1;
      removedBytes += size;
    } catch (err) {
      console.warn(`[fetch-etherpad]   failed to prune ${entry}:`, err.message);
    }
  }
  const mb = (removedBytes / 1024 / 1024).toFixed(1);
  console.log(`[fetch-etherpad]   pruned ${removedCount} .pnpm store entries (${mb} MB)`);
}

async function dirSize(dir) {
  const { readdir: rd, stat: st } = await import('node:fs/promises');
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let items;
    try { items = await rd(current); } catch { continue; }
    for (const name of items) {
      const p = join(current, name);
      let info;
      try { info = await st(p); } catch { continue; }
      if (info.isDirectory()) stack.push(p);
      else total += info.size;
    }
  }
  return total;
}

main().catch((err) => {
  console.error('[fetch-etherpad] failed:', err.message);
  process.exit(1);
});
