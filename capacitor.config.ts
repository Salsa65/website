import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hazel.novelstudio',
  appName: 'Hazel Novel Studio',
  webDir: 'mobile-dist',
  android: {
    backgroundColor: '#070608',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
