export type ProtocolApi = {
  registerSchemesAsPrivileged(
    schemes: Array<{
      scheme: string;
      privileges: { standard: boolean; secure: boolean; supportFetchAPI: boolean; corsEnabled: boolean };
    }>,
  ): void;
};

export function registerEtherpadAppScheme(protocol: ProtocolApi): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'etherpad-app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ]);
}
