import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.aetalley.fieldboard',
  appName: 'Talley Field Board',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
