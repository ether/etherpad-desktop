import { describe, it, expect, vi } from 'vitest';
import { registerEtherpadAppScheme } from '../../../src/main/app/protocol';

describe('registerEtherpadAppScheme', () => {
  it('registers etherpad-app:// as a privileged scheme', () => {
    const protocol = { registerSchemesAsPrivileged: vi.fn() };
    registerEtherpadAppScheme(protocol as never);
    expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      {
        scheme: 'etherpad-app',
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
      },
    ]);
  });
});
