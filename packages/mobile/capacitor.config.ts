import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.etherpad.mobile',
  appName: 'Etherpad',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
