export type ThemePreference = 'light' | 'dark' | 'auto';

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = pref;
}
