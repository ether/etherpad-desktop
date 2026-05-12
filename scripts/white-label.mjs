#!/usr/bin/env node
// Applies a brand config to all config files that carry the app's
// identity, so a fork can ship under its own name without touching
// every YAML/XML/TS file by hand.
//
// Reads `brand.json` at the repo root (or `brand.example.json` if no
// brand.json exists) for defaults, then overrides with CLI flags:
//
//   pnpm white-label
//   pnpm white-label --name "MyPad" --accent "#ff0000"
//   pnpm white-label --name "MyPad" --appId com.example.mypad
//
// V1 scope: text + colour only. Icons are out of scope — drop your own
// PNG set into `packages/desktop/build/icons/` (any of icon-16 … icon-512
// + icon.ico + icon.icns) and `packages/mobile/android/app/src/main/res/
// mipmap-*/ic_launcher*.png` before packaging. The script reports which
// icon files it left untouched so you know what to swap.
//
// Mutations are idempotent: running the script repeatedly on an
// already-applied config is a no-op. Each mutation matches the field
// by surrounding context (a YAML key, a TS property, an XML attribute)
// rather than the current value, so re-runs replace whatever is there.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND_FILE = resolve(REPO_ROOT, 'brand.json');
const BRAND_EXAMPLE = resolve(REPO_ROOT, 'brand.example.json');

const log = (msg) => process.stdout.write(`[white-label] ${msg}\n`);
const warn = (msg) => process.stderr.write(`[white-label] WARN: ${msg}\n`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function readBrand() {
  let file = BRAND_FILE;
  if (!existsSync(file)) {
    if (!existsSync(BRAND_EXAMPLE)) {
      throw new Error(`No brand.json or brand.example.json at ${REPO_ROOT}`);
    }
    log(`brand.json not found, falling back to brand.example.json`);
    file = BRAND_EXAMPLE;
  }
  const raw = readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  // Strip $schema and _comment from the working object.
  delete parsed.$schema;
  delete parsed._comment;
  return parsed;
}

/**
 * Resolve a brand config from brand.json + CLI overrides, with
 * normalisation:
 *  - `shortName` defaults to `name`
 *  - `accent` is forced to a lowercase 6-digit hex (#RRGGBB)
 *  - `publish.owner` / `publish.repo` come in as `--publishOwner` /
 *    `--publishRepo` on the CLI.
 */
export function resolveBrand(brand, args) {
  const out = { ...brand };
  for (const key of ['name', 'shortName', 'appId', 'androidPackage', 'accent', 'description', 'longDescription', 'author', 'copyright']) {
    if (args[key]) out[key] = args[key];
  }
  if (args.publishOwner || args.publishRepo) {
    out.publish = {
      owner: args.publishOwner ?? out.publish?.owner,
      repo: args.publishRepo ?? out.publish?.repo,
    };
  }
  if (!out.shortName && out.name) out.shortName = out.name.split(/\s+/)[0];
  if (out.accent && !/^#[0-9a-fA-F]{6}$/.test(out.accent)) {
    throw new Error(`brand.accent must be a #RRGGBB hex colour, got: ${out.accent}`);
  }
  if (out.accent) out.accent = out.accent.toLowerCase();
  return out;
}

/**
 * Replace a single line in a file based on a regex match for the
 * surrounding context. Throws if the pattern doesn't match — we'd
 * rather fail loudly than silently leave a config in a half-branded
 * state.
 */
function replaceInFile(filePath, replacements) {
  if (!existsSync(filePath)) {
    warn(`skip ${filePath} (not found)`);
    return false;
  }
  let content = readFileSync(filePath, 'utf8');
  const original = content;
  for (const [pattern, replacement, label] of replacements) {
    const next = content.replace(pattern, replacement);
    if (next === content) {
      warn(`${filePath}: no match for ${label} — pattern may have drifted`);
    }
    content = next;
  }
  if (content === original) return false;
  writeFileSync(filePath, content);
  log(`wrote ${filePath}`);
  return true;
}

/**
 * Apply the resolved brand config across every file in the repo that
 * carries the app's identity. Exported so the test can drive it.
 */
export function applyBrand(brand, opts = {}) {
  const root = opts.repoRoot ?? REPO_ROOT;

  // electron-builder.yml — desktop installer + Linux desktop entry.
  if (brand.name || brand.appId || brand.copyright || brand.description || brand.longDescription || brand.author || brand.publish) {
    const replacements = [];
    if (brand.appId) {
      replacements.push([/^appId:\s.*$/m, `appId: ${brand.appId}`, 'appId']);
    }
    if (brand.name) {
      replacements.push([/^productName:\s.*$/m, `productName: ${brand.name}`, 'productName']);
      replacements.push([/(\s+Name:\s+).*$/m, `$1${brand.name}`, 'desktop.Name']);
      replacements.push([/^\s+shortcutName:\s.*$/m, `  shortcutName: ${brand.name}`, 'nsis.shortcutName']);
    }
    if (brand.copyright) {
      replacements.push([/^copyright:\s.*$/m, `copyright: ${brand.copyright}`, 'copyright']);
    }
    if (brand.description) {
      replacements.push([/^(\s+)description:\s.*$/m, `$1description: ${brand.description}`, 'linux.description']);
      replacements.push([/^(\s+)Comment:\s.*$/m, `$1Comment: ${brand.description}`, 'desktop.Comment']);
      replacements.push([/^(\s+)summary:\s.*$/m, `$1summary: ${brand.description}`, 'snap.summary']);
    }
    if (brand.longDescription) {
      // YAML block scalar (literal style) — keep the `|` and indent
      // every line by 4 spaces. snap.description is the only block
      // scalar in this file; pin by surrounding context (key + |).
      const block = brand.longDescription.split('\n').map((l) => `    ${l}`.trimEnd()).join('\n');
      replacements.push([
        /(\n  description:\s\|\n)[\s\S]*?(\npublish:)/,
        `$1${block}\n$2`,
        'snap.description',
      ]);
    }
    if (brand.author) {
      replacements.push([/^(\s+)maintainer:\s.*$/m, `$1maintainer: ${brand.author}`, 'linux.maintainer']);
    }
    if (brand.publish?.owner) {
      replacements.push([/^(\s+)owner:\s.*$/m, `$1owner: ${brand.publish.owner}`, 'publish.owner']);
    }
    if (brand.publish?.repo) {
      replacements.push([/^(\s+)repo:\s.*$/m, `$1repo: ${brand.publish.repo}`, 'publish.repo']);
    }
    if (brand.name) {
      // StartupWMClass — derived from name (lowercase, dashes).
      const wmclass = brand.name.toLowerCase().replace(/\s+/g, '-');
      replacements.push([/^(\s+)StartupWMClass:\s.*$/m, `$1StartupWMClass: ${wmclass}`, 'desktop.StartupWMClass']);
    }
    replaceInFile(resolve(root, 'packages/desktop/build/electron-builder.yml'), replacements);
  }

  // Capacitor config — appId + appName.
  if (brand.androidPackage || brand.shortName) {
    const replacements = [];
    if (brand.androidPackage) {
      replacements.push([/appId:\s*'[^']*'/, `appId: '${brand.androidPackage}'`, 'capacitor.appId']);
    }
    if (brand.shortName) {
      replacements.push([/appName:\s*'[^']*'/, `appName: '${brand.shortName}'`, 'capacitor.appName']);
    }
    replaceInFile(resolve(root, 'packages/mobile/capacitor.config.ts'), replacements);
  }

  // Android build.gradle — namespace + applicationId.
  if (brand.androidPackage) {
    replaceInFile(resolve(root, 'packages/mobile/android/app/build.gradle'), [
      [/(namespace\s*=\s*)"[^"]*"/, `$1"${brand.androidPackage}"`, 'gradle.namespace'],
      [/(applicationId\s+)"[^"]*"/, `$1"${brand.androidPackage}"`, 'gradle.applicationId'],
    ]);
  }

  // Android strings.xml — app name + package id + custom URL scheme.
  if (brand.shortName || brand.androidPackage) {
    const replacements = [];
    if (brand.shortName) {
      replacements.push([
        /(<string name="app_name">)[^<]*(<\/string>)/,
        `$1${brand.shortName}$2`,
        'strings.app_name',
      ]);
      replacements.push([
        /(<string name="title_activity_main">)[^<]*(<\/string>)/,
        `$1${brand.shortName}$2`,
        'strings.title_activity_main',
      ]);
    }
    if (brand.androidPackage) {
      replacements.push([
        /(<string name="package_name">)[^<]*(<\/string>)/,
        `$1${brand.androidPackage}$2`,
        'strings.package_name',
      ]);
      replacements.push([
        /(<string name="custom_url_scheme">)[^<]*(<\/string>)/,
        `$1${brand.androidPackage}$2`,
        'strings.custom_url_scheme',
      ]);
    }
    replaceInFile(resolve(root, 'packages/mobile/android/app/src/main/res/values/strings.xml'), replacements);
  }

  // Shell i18n — app.title across every locale dictionary. Translators
  // may have localised the product name (e.g. fr.ts has "Etherpad
  // Bureau"); a global rename replaces the whole title — translators
  // can re-translate the suffix later if they want.
  if (brand.name) {
    const i18nFiles = ['en.ts', 'es.ts', 'fr.ts', 'de.ts', 'pt.ts', 'it.ts'];
    for (const f of i18nFiles) {
      replaceInFile(resolve(root, `packages/shell/src/i18n/${f}`), [
        [/app:\s*\{\s*title:\s*'[^']*'\s*\}/, `app: { title: '${brand.name}' }`, 'i18n.app.title'],
      ]);
    }
  }

  // CSS accent. The `--color-primary` token is what every other
  // accent-derived var resolves to (--accent, button bg, focus rings).
  if (brand.accent) {
    replaceInFile(resolve(root, 'packages/shell/src/styles/index.css'), [
      [/(--color-primary:\s*)#[0-9a-fA-F]{3,8};/, `$1${brand.accent};`, 'css.--color-primary'],
    ]);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(`
Usage: pnpm white-label [--flag value ...]

Reads brand.json (or brand.example.json fallback) and applies the brand
config to all identity-bearing config files. CLI flags override file
values for ad-hoc builds.

Flags:
  --name <str>              Display name (window title, taskbar, store listing)
  --shortName <str>         Short name (Android home screen). Defaults to first word of name.
  --appId <str>             Desktop bundle id, e.g. org.example.myapp
  --androidPackage <str>    Android package id, e.g. com.example.myapp
  --accent <#RRGGBB>        Accent colour
  --description <str>       One-line description
  --longDescription <str>   Multi-line description for snap/store listings
  --author <str>            Author / maintainer
  --copyright <str>         Copyright line
  --publishOwner <str>      GitHub owner for the autoupdater feed
  --publishRepo <str>       GitHub repo for the autoupdater feed
  --help                    This help text

Examples:
  pnpm white-label
  pnpm white-label --name FooPad --accent '#ff5500'
  pnpm white-label --name FooPad --appId com.example.foopad --androidPackage com.example.foopad

V1 limitation: icons aren't regenerated. Drop your own PNGs into
packages/desktop/build/icons/ and the Android mipmap-*/ic_launcher*.png
files before running the build.
`);
    return;
  }
  const brand = readBrand();
  const resolved = resolveBrand(brand, args);
  applyBrand(resolved);
  log('done. Reminder: replace icons in packages/desktop/build/icons/ and packages/mobile/android/app/src/main/res/mipmap-* with your own before packaging.');
}

// Run main only when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
