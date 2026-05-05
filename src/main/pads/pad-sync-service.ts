import { padUrl } from '@shared/url';

export type ResolveSrcInput =
  | { kind: 'remote'; serverUrl: string; padName: string; lang?: string; userName?: string };
// Spec 5 will add: { kind: 'embedded'; serverPort: number; padName: string };
// Spec 6 will add: { kind: 'cached'; workspaceId: string; padName: string };

export class PadSyncService {
  resolveSrc(input: ResolveSrcInput): string {
    switch (input.kind) {
      case 'remote': {
        const url = padUrl(input.serverUrl, input.padName);
        const params = new URLSearchParams();
        if (input.lang && input.lang !== '') {
          params.set('lang', input.lang);
        }
        if (input.userName && input.userName !== '') {
          params.set('userName', input.userName);
        }
        const qs = params.toString();
        return qs ? `${url}?${qs}` : url;
      }
    }
  }
}
