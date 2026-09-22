import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aetherfall.novelstudio',
  appName: 'Aetherfall',
  webDir: 'mobile-dist',
  android: {
    backgroundColor: '#111014',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
