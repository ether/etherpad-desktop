import { en } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { de } from './de.js';
import { pt } from './pt.js';
import { it } from './it.js';
import type { Strings } from './en.js';

// Bundled shell translations. Etherpad core ships ~115 locales for the
// pad UI itself (via the `?lang=` query param on the iframe src); the
// shell ("rail", dialogs, settings) has its own string table that needs
// its own translations. Locales not listed here fall back to English in
// the shell, but the pad iframe still picks up etherpad core's matching
// locale, so users see partial localisation rather than nothing. Adding
// a locale: create `<code>.ts` with the full `Strings` shape and add it
// here. `pt-br` aliases `pt` until a dedicated dictionary exists.
const dictionary: Record<string, Strings> = {
  en,
  es,
  fr,
  de,
  pt,
  'pt-br': pt,
  it,
};

let active: Strings = en;

export function setLanguage(code: string): void {
  active = dictionary[code] ?? en;
  // Reflect on <html lang=…> so screen readers announce in the right voice
  // and CSS like :lang() can target it. Guard for non-DOM (test) environments.
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = code || 'en';
  }
}

export const t = new Proxy({} as Strings, {
  get(_t, prop: string) {
    return (active as Record<string, unknown>)[prop];
  },
}) as Strings;

export function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k as string] ?? ''));
}
