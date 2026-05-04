import { z } from 'zod';

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  serverUrl: z.string().url(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.number().int().nonnegative(),
});

export const workspacesFileSchema = z.object({
  schemaVersion: z.literal(1),
  workspaces: z.array(workspaceSchema),
  order: z.array(z.string().uuid()),
});
