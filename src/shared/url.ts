export function normalizeServerUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`URL must use http or https: ${input}`);
  }
  url.hash = '';
  url.search = '';
  let pathname = url.pathname.replace(/\/+$/, '');
  if (pathname === '') pathname = '';
  url.pathname = pathname;
  return url.toString().replace(/\/$/, '');
}

export function padUrl(serverUrl: string, padName: string): string {
  const base = normalizeServerUrl(serverUrl);
  return `${base}/p/${encodeURIComponent(padName)}`;
}

/**
 * Parse a pasted Etherpad pad URL into (serverUrl, padName).
 *
 * Accepts:
 *   https://pad.example.com/p/some-pad
 *   https://pad.example.com/p/some-pad?lang=es#anchor   (query/hash stripped)
 *   https://pad.example.com/etherpad/p/some-pad        (path-prefixed instance)
 *   https://pad.example.com/p/some%20pad               (decoded)
 *
 * Returns null when the URL is malformed, has a non-http(s) protocol, or
 * doesn't contain a `/p/<name>` segment with a non-empty name.
 *
 * Used by the "Open Pad by URL…" flow to decide whether the URL points
 * at an Etherpad instance the user has already added, or whether we need
 * to add one before opening the pad.
 */
export function parsePadUrl(input: string): { serverUrl: string; padName: string } | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const m = url.pathname.match(/^(.*?)\/p\/([^/]+)\/?$/);
  if (!m) return null;
  const [, prefix, encodedName] = m;
  let padName: string;
  try {
    padName = decodeURIComponent(encodedName!);
  } catch {
    return null;
  }
  if (!padName) return null;
  url.search = '';
  url.hash = '';
  url.pathname = (prefix ?? '').replace(/\/+$/, '');
  const serverUrl = url.toString().replace(/\/$/, '');
  return { serverUrl, padName };
}
