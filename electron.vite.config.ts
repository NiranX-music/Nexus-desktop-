import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isTrialBuild = process.env.NEXUS_APP_FLAVOR === 'trial'

const rendererAliases = {
  '@renderer': resolve('src/renderer/src'),
  '@flavor-root': isTrialBuild
    ? resolve('src/renderer/src/trial-app/TrialRoot.tsx')
    : resolve('src/renderer/src/full-app/FullRoot.tsx'),
  '@flavor-login': isTrialBuild
    ? resolve('src/renderer/src/trial-app/TrialLogin.tsx')
    : resolve('src/renderer/src/full-app/FullLogin.tsx')
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    publicDir: resolve('src/renderer/src/public'),
    resolve: {
      alias: rendererAliases
    },
    plugins: [react(), tailwindcss()]
  }
})
