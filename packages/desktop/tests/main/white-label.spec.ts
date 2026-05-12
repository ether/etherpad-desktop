import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * White-label script contract test. Drives the actual `applyBrand`
 * function from `scripts/white-label.mjs` against a temp fixture tree,
 * then asserts every identity-bearing config file flipped to the new
 * brand. Acts as a regression net: if anyone re-arranges the patterns
 * inside the script and silently breaks a substitution, this catches
 * it.
 *
 * Fixtures are minimised verbatim copies of the relevant config files
 * — just enough surrounding context for the script's regexes to match.
 * The full repo files have more content, but the script only touches
 * the lines that appear here.
 */

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../scripts/white-label.mjs',
);

// Lazy-load via dynamic import so the script's `main()` doesn't fire
// at module-load time (it's gated on import.meta.url === argv[1]).
const loadScript = async (): Promise<{
  applyBrand: (brand: Record<string, unknown>, opts?: { repoRoot?: string }) => void;
  resolveBrand: (brand: Record<string, unknown>, args: Record<string, unknown>) => Record<string, unknown>;
}> => {
  const mod = await import(`file://${SCRIPT_PATH}`);
  return mod as { applyBrand: (b: Record<string, unknown>, o?: { repoRoot?: string }) => void; resolveBrand: (b: Record<string, unknown>, a: Record<string, unknown>) => Record<string, unknown> };
};

const FIXTURE_ELECTRON_BUILDER = `appId: org.etherpad.desktop
productName: Etherpad Desktop
copyright: Copyright (c) 2026 The Etherpad Foundation

linux:
  description: Native desktop client for Etherpad
  maintainer: Etherpad Foundation <noreply@etherpad.org>
  desktop:
    entry:
      Name: Etherpad Desktop
      Comment: Native desktop client for Etherpad
      Categories: Office;TextEditor;
      StartupWMClass: etherpad-desktop

nsis:
  shortcutName: Etherpad Desktop

snap:
  summary: Native desktop client for Etherpad
  description: |
    Default upstream blurb that the test rewrites.
    Multiple lines so we can verify the block-scalar replacement
    preserves the YAML key.
publish:
  - provider: github
    owner: ether
    repo: etherpad-desktop
`;

const FIXTURE_CAPACITOR = `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.etherpad.mobile',
  appName: 'Etherpad',
  webDir: 'dist',
};

export default config;
`;

const FIXTURE_BUILD_GRADLE = `apply plugin: 'com.android.application'

android {
    namespace = "com.etherpad.mobile"
    defaultConfig {
        applicationId "com.etherpad.mobile"
    }
}
`;

const FIXTURE_STRINGS_XML = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Etherpad</string>
    <string name="title_activity_main">Etherpad</string>
    <string name="package_name">com.etherpad.mobile</string>
    <string name="custom_url_scheme">com.etherpad.mobile</string>
</resources>
`;

const FIXTURE_EN_TS = `export const en = {
  app: { title: 'Etherpad Desktop' },
  rail: { label: 'Etherpad instance rail' },
};
export type Strings = typeof en;
`;

const FIXTURE_CSS = `:root {
  --color-primary: #44b492;
  --color-accent: #2e2e32;
}
`;

let repoRoot: string;

function seedFixture(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'white-label-test-'));
  const write = (rel: string, content: string): void => {
    const full = resolve(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  write('packages/desktop/build/electron-builder.yml', FIXTURE_ELECTRON_BUILDER);
  write('packages/mobile/capacitor.config.ts', FIXTURE_CAPACITOR);
  write('packages/mobile/android/app/build.gradle', FIXTURE_BUILD_GRADLE);
  write('packages/mobile/android/app/src/main/res/values/strings.xml', FIXTURE_STRINGS_XML);
  write('packages/shell/src/i18n/en.ts', FIXTURE_EN_TS);
  // Other locales exist in the real repo — script iterates a fixed
  // list. We only seed en.ts; missing files are silently skipped (the
  // script warns but doesn't error).
  write('packages/shell/src/styles/index.css', FIXTURE_CSS);
  return dir;
}

const read = (rel: string): string => readFileSync(resolve(repoRoot, rel), 'utf8');

beforeEach(() => {
  repoRoot = seedFixture();
});

describe('white-label apply', () => {
  it('rewrites every identity-bearing field across the config tree', async () => {
    const { applyBrand } = await loadScript();
    applyBrand(
      {
        name: 'FooPad',
        shortName: 'Foo',
        appId: 'com.example.foopad',
        androidPackage: 'com.example.foo',
        accent: '#ff5500',
        description: 'A FooPad fork',
        longDescription: 'FooPad is the fork your team deserves.\nLine 2.',
        author: 'Foo Team <foo@example.com>',
        copyright: 'Copyright (c) 2026 Foo Team',
        publish: { owner: 'foo', repo: 'foopad-desktop' },
      },
      { repoRoot },
    );

    const electronYml = read('packages/desktop/build/electron-builder.yml');
    expect(electronYml).toContain('appId: com.example.foopad');
    expect(electronYml).toContain('productName: FooPad');
    expect(electronYml).toContain('copyright: Copyright (c) 2026 Foo Team');
    expect(electronYml).toContain('description: A FooPad fork');
    expect(electronYml).toContain('maintainer: Foo Team <foo@example.com>');
    expect(electronYml).toContain('Name: FooPad');
    expect(electronYml).toContain('Comment: A FooPad fork');
    expect(electronYml).toContain('StartupWMClass: foopad');
    expect(electronYml).toContain('shortcutName: FooPad');
    expect(electronYml).toContain('summary: A FooPad fork');
    expect(electronYml).toContain('FooPad is the fork your team deserves');
    expect(electronYml).toContain('owner: foo');
    expect(electronYml).toContain('repo: foopad-desktop');
    // Block-scalar replacement preserves the YAML key + pipe character.
    expect(electronYml).toMatch(/description: \|\n {4}FooPad is the fork your team deserves/);

    const capacitor = read('packages/mobile/capacitor.config.ts');
    expect(capacitor).toContain("appId: 'com.example.foo'");
    expect(capacitor).toContain("appName: 'Foo'");

    const gradle = read('packages/mobile/android/app/build.gradle');
    expect(gradle).toContain('namespace = "com.example.foo"');
    expect(gradle).toContain('applicationId "com.example.foo"');

    const stringsXml = read('packages/mobile/android/app/src/main/res/values/strings.xml');
    expect(stringsXml).toContain('<string name="app_name">Foo</string>');
    expect(stringsXml).toContain('<string name="title_activity_main">Foo</string>');
    expect(stringsXml).toContain('<string name="package_name">com.example.foo</string>');
    expect(stringsXml).toContain('<string name="custom_url_scheme">com.example.foo</string>');

    const enTs = read('packages/shell/src/i18n/en.ts');
    expect(enTs).toContain("app: { title: 'FooPad' }");

    const css = read('packages/shell/src/styles/index.css');
    expect(css).toContain('--color-primary: #ff5500;');
  });

  it('partial brand objects only mutate the fields they cover', async () => {
    const { applyBrand } = await loadScript();
    applyBrand({ name: 'OnlyName' }, { repoRoot });

    // Name fields flipped.
    expect(read('packages/desktop/build/electron-builder.yml')).toContain('productName: OnlyName');
    expect(read('packages/shell/src/i18n/en.ts')).toContain("'OnlyName'");

    // Untouched fields keep their fixture defaults.
    expect(read('packages/desktop/build/electron-builder.yml')).toContain('appId: org.etherpad.desktop');
    expect(read('packages/mobile/capacitor.config.ts')).toContain("appId: 'com.etherpad.mobile'");
    expect(read('packages/shell/src/styles/index.css')).toContain('--color-primary: #44b492;');
  });

  it('is idempotent — running twice produces the same output', async () => {
    const { applyBrand } = await loadScript();
    const brand = { name: 'IdemPad', accent: '#123456' };
    applyBrand(brand, { repoRoot });
    const afterFirst = read('packages/desktop/build/electron-builder.yml');
    applyBrand(brand, { repoRoot });
    const afterSecond = read('packages/desktop/build/electron-builder.yml');
    expect(afterSecond).toEqual(afterFirst);
  });

  it('resolveBrand applies CLI overrides on top of the file config', async () => {
    const { resolveBrand } = await loadScript();
    const brand = { name: 'FromFile', accent: '#000000', appId: 'org.file.app' };
    const resolved = resolveBrand(brand, { name: 'FromCli', publishOwner: 'cliuser' });
    expect(resolved.name).toBe('FromCli');
    // accent stays from file
    expect(resolved.accent).toBe('#000000');
    // appId stays from file
    expect(resolved.appId).toBe('org.file.app');
    // publish.owner from CLI flag
    expect((resolved.publish as { owner: string }).owner).toBe('cliuser');
  });

  it('resolveBrand rejects malformed accent colours', async () => {
    const { resolveBrand } = await loadScript();
    expect(() => resolveBrand({ accent: 'red' }, {})).toThrow(/#RRGGBB/);
    expect(() => resolveBrand({ accent: '#ff5' }, {})).toThrow(/#RRGGBB/);
    expect(() => resolveBrand({ accent: '#abcdef' }, {})).not.toThrow();
  });

  it('resolveBrand normalises accent to lowercase', async () => {
    const { resolveBrand } = await loadScript();
    const resolved = resolveBrand({ accent: '#ABCDEF' }, {});
    expect(resolved.accent).toBe('#abcdef');
  });

  it('resolveBrand derives shortName from the first word of name when omitted', async () => {
    const { resolveBrand } = await loadScript();
    const resolved = resolveBrand({ name: 'Acme Notebook' }, {});
    expect(resolved.shortName).toBe('Acme');
  });
});

// Tear-down — rmSync the tmp dir after each test. Not in afterEach
// because beforeEach reassigns `repoRoot`; we'd race ourselves cleaning
// the wrong directory. Vitest cleans /tmp/white-label-test-* between
// runs anyway, but be polite:
import { afterEach } from 'vitest';
afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});
