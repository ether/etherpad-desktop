// tests/main/ipc/dispatcher.spec.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { wrapHandler } from '../../../src/main/ipc/dispatcher';
import { StorageError } from '@shared/types/errors';

describe('wrapHandler', () => {
  const schema = z.object({ n: z.number() });

  it('returns ok:true with value on success', async () => {
    const h = wrapHandler('test.ok', schema, async (p) => p.n * 2);
    expect(await h(undefined, { n: 3 })).toEqual({ ok: true, value: 6 });
  });

  it('returns ok:false with InvalidPayloadError on schema fail', async () => {
    const h = wrapHandler('test.bad', schema, async () => 1);
    const r = await h(undefined, { n: 'nope' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });

  it('returns ok:false with serialised AppError on handler throw', async () => {
    const h = wrapHandler('test.throw', schema, async () => {
      throw new StorageError('disk full');
    });
    const r = await h(undefined, { n: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('StorageError');
      expect(r.error.message).toBe('disk full');
    }
  });

  it('serialises non-AppError exceptions as StorageError', async () => {
    const h = wrapHandler('test.unknown', schema, async () => {
      throw new Error('weird');
    });
    const r = await h(undefined, { n: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('StorageError');
  });
});
