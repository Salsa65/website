import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reforge.duo',
  appName: 'Redbound',
  webDir: 'mobile-dist',
  android: {
    backgroundColor: '#07070a',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
