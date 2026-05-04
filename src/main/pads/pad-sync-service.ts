import { padUrl } from '@shared/url';

export type ResolveSrcInput =
  | { kind: 'remote'; serverUrl: string; padName: string };
// Spec 5 will add: { kind: 'embedded'; serverPort: number; padName: string };
// Spec 6 will add: { kind: 'cached'; workspaceId: string; padName: string };

export class PadSyncService {
  resolveSrc(input: ResolveSrcInput): string {
    switch (input.kind) {
      case 'remote':
        return padUrl(input.serverUrl, input.padName);
    }
  }
}
