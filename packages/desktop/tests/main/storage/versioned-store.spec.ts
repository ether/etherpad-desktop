import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { VersionedStore } from '../../../src/main/storage/versioned-store';

const schema = z.object({
  schemaVersion: z.literal(1),
  count: z.number().int().nonnegative(),
});

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-store-'));
  file = join(dir, 'thing.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('VersionedStore', () => {
  it('returns defaults when file does not exist', () => {
    const s = new VersionedStore({ file, schema, defaults: () => ({ schemaVersion: 1, count: 0 }) });
    expect(s.read()).toEqual({ schemaVersion: 1, count: 0 });
  });

  it('round-trips written data', () => {
    const s = new VersionedStore({ file, schema, defaults: () => ({ schemaVersion: 1, count: 0 }) });
    s.write({ schemaVersion: 1, count: 3 });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ schemaVersion: 1, count: 3 });
    const s2 = new VersionedStore({ file, schema, defaults: () => ({ schemaVersion: 1, count: 0 }) });
    expect(s2.read()).toEqual({ schemaVersion: 1, count: 3 });
  });

  it('renames corrupt file to .broken-<ts>.json and returns defaults', () => {
    writeFileSync(file, 'not json {{{');
    const s = new VersionedStore({ file, schema, defaults: () => ({ schemaVersion: 1, count: 0 }) });
    expect(s.read()).toEqual({ schemaVersion: 1, count: 0 });
    const files = readdirSync(dir);
    expect(files.some((f) => f.startsWith('thing.broken-') && f.endsWith('.json'))).toBe(true);
  });

  it('renames schema-mismatched file and returns defaults', () => {
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, count: -5 }));
    const s = new VersionedStore({ file, schema, defaults: () => ({ schemaVersion: 1, count: 0 }) });
    expect(s.read().count).toBe(0);
    const broken = readdirSync(dir).find((f) => f.startsWith('thing.broken-'));
    expect(broken).toBeDefined();
  });

  it('refuses to start when version is newer than ours', () => {
    writeFileSync(file, JSON.stringify({ schemaVersion: 99, count: 0 }));
    const s = new VersionedStore({
      file,
      schema,
      defaults: () => ({ schemaVersion: 1, count: 0 }),
      currentVersion: 1,
    });
    expect(() => s.read()).toThrow(/newer/i);
  });

  it('writes atomically (no partial file on schema-version override)', () => {
    const s = new VersionedStore({ file, schema, defaults: () => ({ schemaVersion: 1, count: 0 }) });
    s.write({ schemaVersion: 1, count: 1 });
    const tmpFiles = readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);
    expect(existsSync(file)).toBe(true);
  });

  it('creates parent directory if missing', () => {
    const nested = join(dir, 'nested', 'deeper', 'x.json');
    const s = new VersionedStore({ file: nested, schema, defaults: () => ({ schemaVersion: 1, count: 0 }) });
    s.write({ schemaVersion: 1, count: 1 });
    expect(existsSync(nested)).toBe(true);
  });
});
