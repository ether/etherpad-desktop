import type { z } from 'zod';
import { InvalidPayloadError, serializeError } from '@shared/types/errors';
import type { IpcResult } from '@shared/ipc/channels';

export type WrappedHandler<O> = (event: unknown, input: unknown) => Promise<IpcResult<O>>;

export function wrapHandler<S extends z.ZodType, O>(
  channel: string,
  schema: S,
  handler: (input: z.infer<S>, event: unknown) => Promise<O> | O,
): WrappedHandler<O> {
  return async (event, input) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const e = new InvalidPayloadError(`${channel}: ${parsed.error.message}`);
      return { ok: false, error: serializeError(e) };
    }
    try {
      const value = await handler(parsed.data as z.infer<S>, event);
      return { ok: true, value };
    } catch (err) {
      return { ok: false, error: serializeError(err) };
    }
  };
}
