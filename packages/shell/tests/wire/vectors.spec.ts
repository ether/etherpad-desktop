import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

/**
 * Downstream wire-compatibility — fixture-integrity guard.
 *
 * Phase 2 of ether/etherpad#7923. Phase 1 added a canonical wire-format
 * fixture (`wire-vectors.json`) that every Etherpad client must decode
 * identically. The Rust/CLI clients re-implement changeset decoding and
 * therefore run these vectors through their own decoder.
 *
 * The desktop/mobile apps are thin shells: they load an Etherpad server URL
 * and embed CORE'S editor (Ace) inside a webview, so there is NO local
 * changeset decoder to exercise. This test is therefore a *fixture-integrity
 * guard* rather than a decode test — it asserts the shape/contract of the
 * vendored fixture so that:
 *   - a malformed or empty fixture injected into this repo fails loudly, and
 *   - the contract the embedded editor relies on is documented in-repo.
 *
 * The fixture path is overridable via `ETHERPAD_WIRE_VECTORS`, defaulting to
 * the vendored copy next to this test.
 */

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_VECTORS_PATH = resolve(here, '../fixtures/wire-vectors.json');
const VECTORS_PATH = process.env.ETHERPAD_WIRE_VECTORS || DEFAULT_VECTORS_PATH;

interface WireVector {
  name: string;
  initialText: string;
  changeset: string;
  pool: { numToAttrib: Record<string, unknown>; nextNum: number };
  resultText: string;
}

function loadVectors(): WireVector[] {
  const raw = readFileSync(VECTORS_PATH, 'utf8');
  return JSON.parse(raw) as WireVector[];
}

describe('wire-vectors fixture integrity', () => {
  const vectors = loadVectors();

  it('is a non-empty array', () => {
    expect(Array.isArray(vectors)).toBe(true);
    expect(vectors.length).toBeGreaterThan(0);
  });

  it('has unique vector names', () => {
    const names = vectors.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });

  describe.each(vectors.map((v) => [v.name, v] as const))('vector %s', (_name, v) => {
    it('has all five fields with the right types', () => {
      expect(typeof v.name).toBe('string');
      expect(v.name.length).toBeGreaterThan(0);
      expect(typeof v.initialText).toBe('string');
      expect(typeof v.changeset).toBe('string');
      expect(v.changeset.length).toBeGreaterThan(0);
      expect(typeof v.resultText).toBe('string');
      expect(typeof v.pool).toBe('object');
      expect(v.pool).not.toBeNull();
    });

    it('changeset uses the canonical Z: header', () => {
      expect(v.changeset.startsWith('Z:')).toBe(true);
    });

    it('pool.numToAttrib is a plain object and pool.nextNum is a number', () => {
      expect(typeof v.pool.numToAttrib).toBe('object');
      expect(v.pool.numToAttrib).not.toBeNull();
      expect(Array.isArray(v.pool.numToAttrib)).toBe(false);
      expect(typeof v.pool.nextNum).toBe('number');
      expect(Number.isInteger(v.pool.nextNum)).toBe(true);
      expect(v.pool.nextNum).toBeGreaterThanOrEqual(0);
    });

    it('initialText and resultText are non-empty and newline-terminated', () => {
      expect(v.initialText.length).toBeGreaterThan(0);
      expect(v.initialText.endsWith('\n')).toBe(true);
      expect(v.resultText.length).toBeGreaterThan(0);
      expect(v.resultText.endsWith('\n')).toBe(true);
    });
  });
});
