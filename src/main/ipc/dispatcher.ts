import type { z } from 'zod';
import { InvalidPayloadError, serializeError } from '@shared/types/errors';
import type { IpcResult } from '@shared/ipc/channels';

export type WrappedHandler<O> = (event: unknown, input: unknown) => Promise<IpcResult<O>>;

export function wrapHandler<I, O>(
  channel: string,
  schema: z.ZodType<I>,
  handler: (input: I, event: unknown) => Promise<O> | O,
): WrappedHandler<O> {
  return async (event, input) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const e = new InvalidPayloadError(`${channel}: ${parsed.error.message}`);
      return { ok: false, error: serializeError(e) };
    }
    try {
      const value = await handler(parsed.data, event);
      return { ok: true, value };
    } catch (err) {
      return { ok: false, error: serializeError(err) };
    }
  };
}
