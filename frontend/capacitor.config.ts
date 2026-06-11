import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flex.app',
  appName: 'Flex',
  webDir: 'dist',
  // Point to your local backend during development
  // Change this to your production URL before publishing to app stores
  server: {
    // No server.url — app loads from bundled dist files
    // API calls go to the backend separately via src/config.ts
    cleartext: true, // Allow HTTP (not just HTTPS) for dev
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
