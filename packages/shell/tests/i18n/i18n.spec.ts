import { describe, it, expect } from 'vitest';
import { en } from '../../src/i18n/en';
import { setLanguage, t, fmt } from '../../src/i18n/index';

/**
 * i18n contract tests.
 *
 * These tests pin the SHAPE of the dictionary so that adding a new locale
 * (`fr`, `es`, `de`, …) is mechanical: the locale must define exactly the
 * same keys as `en`. They also pin the runtime helpers so a regression in
 * t/setLanguage/fmt is caught immediately.
 */

describe('i18n: en dictionary shape', () => {
  it('exposes the namespaces the UI depends on', () => {
    expect(Object.keys(en).sort()).toEqual(
      [
        'addWorkspace',
        'app',
        'clearAllHistory',
        'emptyState',
        'errorBoundary',
        'httpAuth',
        'openPad',
        'openByUrl',
        'quickSwitcher',
        'rail',
        'removeWorkspace',
        'settings',
        'sidebar',
        'tabError',
        'tabStrip',
        'updater',
        'workspaceRow',
      ].sort(),
    );
  });

  it('every leaf is a non-empty string', () => {
    const walk = (obj: unknown, path: string): void => {
      if (typeof obj === 'string') {
        expect(obj.length, `key ${path} must not be empty`).toBeGreaterThan(0);
        return;
      }
      if (typeof obj !== 'object' || obj === null) {
        throw new Error(`unexpected non-leaf at ${path}: ${typeof obj}`);
      }
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    };
    walk(en, '');
  });

  it('exposes the rail/sidebar a11y labels we audit-fixed', () => {
    // REGRESSION: 2026-05-05 these aria-labels used to be hardcoded strings.
    // Pin the keys so a future refactor can't silently drop them.
    expect(en.rail.label).toBeTruthy();
    expect(en.rail.openWorkspace).toContain('{{name}}');
    expect(en.sidebar.label).toBeTruthy();
    expect(en.sidebar.pinPad).toContain('{{name}}');
    expect(en.sidebar.unpinPad).toContain('{{name}}');
    expect(en.tabStrip.error).toBeTruthy();
  });
});

describe('i18n: t proxy', () => {
  it('returns the active dictionary value', () => {
    setLanguage('en');
    expect(t.app.title).toBe(en.app.title);
    expect(t.openPad.submit).toBe(en.openPad.submit);
  });

  it('falls back to en for unknown locale', () => {
    setLanguage('xx-not-a-locale');
    expect(t.app.title).toBe(en.app.title);
  });

  it('switches to bundled non-en locales (es, fr, de, pt, it, pt-br alias)', () => {
    // Regression guard: previously only `en` was registered, so picking
    // a non-English language in Settings was silently a no-op on shell
    // strings. Pin one assertion per bundled locale so we notice if a
    // locale gets dropped from the dictionary or its key set drifts.
    setLanguage('es');
    expect(t.openPad.submit).toBe('Abrir');
    expect(t.settings.cancel).toBe('Cancelar');

    setLanguage('fr');
    expect(t.openPad.submit).toBe('Ouvrir');

    setLanguage('de');
    expect(t.openPad.submit).toBe('Öffnen');

    setLanguage('pt');
    expect(t.openPad.submit).toBe('Abrir');

    setLanguage('it');
    expect(t.openPad.submit).toBe('Apri');

    // pt-br aliases pt until a dedicated dictionary exists.
    setLanguage('pt-br');
    expect(t.openPad.submit).toBe('Abrir');
  });

  it('reflects the active language on document.documentElement.lang', () => {
    setLanguage('es');
    expect(document.documentElement.lang).toBe('es');
    setLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('treats an empty code as "en" on the html lang attribute', () => {
    setLanguage('');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('i18n: fmt', () => {
  it('substitutes {{name}}-style placeholders', () => {
    expect(fmt('Hello {{name}}', { name: 'Alice' })).toBe('Hello Alice');
  });

  it('substitutes multiple placeholders', () => {
    expect(fmt('{{a}} and {{b}}', { a: 'x', b: 'y' })).toBe('x and y');
  });

  it('emits empty string for missing keys (does not crash)', () => {
    expect(fmt('Hello {{name}}', {})).toBe('Hello ');
  });

  it('leaves unrelated braces alone', () => {
    expect(fmt('{not a placeholder}', {})).toBe('{not a placeholder}');
  });
});
