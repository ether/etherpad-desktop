import { z } from 'zod';

export const padHistoryEntrySchema = z.object({
  workspaceId: z.string().uuid(),
  padName: z.string().min(1).max(200),
  lastOpenedAt: z.number().int().nonnegative(),
  pinned: z.boolean(),
  title: z.string().min(1).max(200).optional(),
});

export const padHistoryFileSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(padHistoryEntrySchema),
});
