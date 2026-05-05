import type { Settings } from '@shared/types/settings';

export type ThemePreference = 'light' | 'dark' | 'auto';

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = pref;
}

export function applyAccentColor(color: string): void {
  // Override the brand accent. Falls back to the brand green when the user
  // resets it (color === defaultSettings.accentColor matches the brand).
  document.documentElement.style.setProperty('--accent', color);
}

export function applySettings(s: Settings): void {
  applyTheme(s.themePreference);
  applyAccentColor(s.accentColor);
}
