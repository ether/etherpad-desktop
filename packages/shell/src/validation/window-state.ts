import { z } from 'zod';

const boundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const tabSchema = z.object({
  workspaceId: z.string().uuid(),
  padName: z.string().min(1).max(200),
});

const windowSchema = z.object({
  activeWorkspaceId: z.string().uuid().nullable(),
  bounds: boundsSchema,
  openTabs: z.array(tabSchema),
  activeTabIndex: z.number().int().min(-1),
});

export const windowStateSchema = z.object({
  schemaVersion: z.literal(1),
  windows: z.array(windowSchema),
});
