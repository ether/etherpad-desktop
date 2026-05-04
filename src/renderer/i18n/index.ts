import { en } from './en.js';
import type { Strings } from './en.js';

const dictionary: Record<string, Strings> = { en };

let active: Strings = en;

export function setLanguage(code: string): void {
  active = dictionary[code] ?? en;
}

export const t = new Proxy({} as Strings, {
  get(_t, prop: string) {
    return (active as Record<string, unknown>)[prop];
  },
}) as Strings;

export function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k as string] ?? ''));
}
