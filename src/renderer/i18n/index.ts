import { en } from './en.js';
import type { Strings } from './en.js';

const dictionary: Record<string, Strings> = { en };

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
