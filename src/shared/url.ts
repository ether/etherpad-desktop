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
