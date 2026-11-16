import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.plyo.games',
  appName: 'Plyo',
  webDir: 'dist',
  backgroundColor: '#0f1a21',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
  plugins: {
    StatusBar: { overlaysWebView: true, style: 'DARK' },
  },
};

export default config;
