import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyTheme } from '../../../src/renderer/theme';

// jsdom does not evaluate CSS custom properties via getComputedStyle when CSS
// is imported as a module (the CSS import is handled by Vite's transform but
// the CSSOM is not populated in jsdom). We therefore assert directly on the
// CSS source text that the surface tokens are defined for both light and dark
// modes, which is a reliable smoke test that the tokens exist.
const cssPath = resolve(__dirname, '../../../src/renderer/styles/index.css');
const css = readFileSync(cssPath, 'utf-8');

describe('dark mode CSS', () => {
  it('light-mode surface tokens are defined in :root', () => {
    expect(css).toMatch(/--body-bg:\s*#ffffff/);
    expect(css).toMatch(/--panel-bg:\s*#ffffff/);
    expect(css).toMatch(/--input-bg:\s*#ffffff/);
    expect(css).toMatch(/--modal-overlay-bg:/);
    expect(css).toMatch(/--error-overlay-bg:/);
  });

  it('dark-mode overrides exist inside @media (prefers-color-scheme: dark)', () => {
    const darkBlock = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\}\s*\}/)?.[1] ?? '';
    expect(darkBlock).toMatch(/--body-bg:/);
    expect(darkBlock).toMatch(/--panel-bg:/);
    expect(darkBlock).toMatch(/--input-bg:/);
    expect(darkBlock).toMatch(/--tab-strip-bg:/);
    expect(darkBlock).toMatch(/--modal-overlay-bg:/);
  });

  it('dark body-bg is NOT #ffffff', () => {
    // extract the value after --body-bg: inside the dark block
    const darkBlock = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\}\s*\}/)?.[1] ?? '';
    const match = darkBlock.match(/--body-bg:\s*([^;]+);/);
    expect(match).not.toBeNull();
    expect(match![1]!.trim()).not.toBe('#ffffff');
  });

  it('color-scheme: light dark is declared', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
  });

  it(':root[data-theme="dark"] manual override rule is defined in CSS', () => {
    expect(css).toMatch(/:root\[data-theme='dark'\]/);
  });

  it('@media auto rule targets :root[data-theme="auto"]', () => {
    expect(css).toMatch(/:root\[data-theme='auto'\]/);
  });
});

describe('applyTheme helper', () => {
  afterEach(() => {
    // Reset data-theme after each test
    delete document.documentElement.dataset.theme;
  });

  it('sets data-theme="dark" on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('sets data-theme="light" on <html>', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('sets data-theme="auto" on <html>', () => {
    applyTheme('auto');
    expect(document.documentElement.dataset.theme).toBe('auto');
  });
});
