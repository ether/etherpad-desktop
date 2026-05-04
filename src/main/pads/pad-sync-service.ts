import { padUrl } from '@shared/url';

export type ResolveSrcInput =
  | { kind: 'remote'; serverUrl: string; padName: string; lang?: string };
// Spec 5 will add: { kind: 'embedded'; serverPort: number; padName: string };
// Spec 6 will add: { kind: 'cached'; workspaceId: string; padName: string };

export class PadSyncService {
  resolveSrc(input: ResolveSrcInput): string {
    switch (input.kind) {
      case 'remote': {
        const url = padUrl(input.serverUrl, input.padName);
        if (input.lang && input.lang !== '') {
          return `${url}?lang=${encodeURIComponent(input.lang)}`;
        }
        return url;
      }
    }
  }
}
