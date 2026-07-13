import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Android TV shell.
 *
 * The shell simply loads the published Lovable app in a WebView. Publish
 * your project (Publish button → https://<slug>.lovable.app) and paste the
 * URL below. Any change you make in Lovable then goes live immediately —
 * you do NOT need to rebuild the APK.
 *
 * `?tv=1` forces StreamFlow's TV mode inside the WebView (see detectTv()
 * in src/hooks/useRemoteControl.ts).
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.streamflow.tv',
  appName: 'StreamFlow TV',
  webDir: 'dist',
  server: {
    // TODO: replace with your Lovable published URL, then run: npx cap sync android
    url: 'https://REPLACE-ME.lovable.app/?tv=1',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#0a0704',
  },
};

export default config;