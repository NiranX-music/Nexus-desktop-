/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly MAIN_VITE_GEMINI_API_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_NEXUS_WEB_APP_URL: string
  readonly VITE_NEXUS_APP_VERSION: string
  readonly VITE_NEXUS_APP_FLAVOR: 'full' | 'trial'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
