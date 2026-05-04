/**
 * Full list of Etherpad's bundled locale codes (115 total).
 * Generated from: ls /home/jose/etherpad/etherpad-lite/src/locales/ | sed 's/\.json$//' | sort
 */
export const ETHERPAD_LOCALES: readonly string[] = [
  'af', 'ar', 'ast', 'awa', 'az', 'azb', 'bcc', 'be-tarask', 'bg', 'bgn',
  'bn', 'br', 'bs', 'ca', 'ce', 'cs', 'da', 'de', 'diq', 'dsb',
  'dty', 'el', 'en', 'en-gb', 'eo', 'es', 'et', 'eu', 'fa', 'ff',
  'fi', 'fo', 'fr', 'fy', 'ga', 'gl', 'got', 'gu', 'he', 'hi',
  'hr', 'hrx', 'hsb', 'hu', 'hy', 'ia', 'id', 'is', 'it', 'ja',
  'kab', 'km', 'kn', 'ko', 'krc', 'ksh', 'ku-latn', 'lb', 'lki', 'lrc',
  'lt', 'lv', 'map-bms', 'mg', 'mk', 'ml', 'mn', 'mnw', 'mr', 'ms',
  'my', 'nah', 'nap', 'nb', 'nds', 'ne', 'nl', 'nn', 'oc', 'olo',
  'os', 'pa', 'pl', 'pms', 'ps', 'pt', 'pt-br', 'qqq', 'ro', 'ru',
  'sc', 'sco', 'sd', 'sh-latn', 'shn', 'sk', 'skr-arab', 'sl', 'sms', 'sq',
  'sr-ec', 'sr-el', 'sro', 'sv', 'sw', 'ta', 'tcy', 'te', 'th', 'tr',
  'uk', 'vec', 'vi', 'zh-hans', 'zh-hant',
] as const;

export type EtherpadLocale = typeof ETHERPAD_LOCALES[number];

/**
 * Returns a human-readable display name for a locale code.
 * Tries to show the name in the language's own script first (e.g. "Español" for "es"),
 * then falls back to English, then to the bare code.
 */
export function localeDisplayName(code: string): string {
  try {
    // Show the language name in its own language: "Español" for "es", "Français" for "fr".
    const own = new Intl.DisplayNames([code], { type: 'language' });
    const native = own.of(code);
    if (native && native !== code) return native;
  } catch {
    // Some codes like 'be-tarask' may not be recognised by Intl; fall through.
  }
  try {
    const en = new Intl.DisplayNames(['en'], { type: 'language' });
    return en.of(code) ?? code;
  } catch {
    return code;
  }
}
