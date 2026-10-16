import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mariodod.pocketminer',
  appName: 'Pocket Miner',
  webDir: 'dist',
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
