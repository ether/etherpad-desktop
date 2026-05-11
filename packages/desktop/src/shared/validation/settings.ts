import { z } from 'zod';
import type { Settings } from '../types/settings.js';

export const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  defaultZoom: z.number().min(0.5).max(3),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  language: z.string().min(2).max(35),
  rememberOpenTabsOnQuit: z.boolean(),
  minimizeToTray: z.boolean(),
  themePreference: z.enum(['light', 'dark', 'auto']).catch('auto'),
  userName: z.string().max(80).catch(''),
});

export const defaultSettings: Settings = {
  schemaVersion: 1,
  defaultZoom: 1,
  accentColor: '#3366cc',
  language: 'en',
  rememberOpenTabsOnQuit: true,
  minimizeToTray: true,
  themePreference: 'auto',
  userName: '',
};
