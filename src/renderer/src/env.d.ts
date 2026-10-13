/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string
  readonly MAIN_VITE_GEMINI_API_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_NEXUS_APP_VERSION?: string
  readonly VITE_NEXUS_APP_FLAVOR?: string
  readonly VITE_BACKEND_KEY?: string
  readonly VITE_NEXUS_WEB_APP_URL?: string
  readonly [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const content: any
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string
      httpreferrer?: string
      useragent?: string
      disablewebsecurity?: boolean | string
      partition?: string
      allowpopups?: boolean | string
      webpreferences?: string
      blinkfeatures?: string
      disableblinkfeatures?: string
      guestinstance?: string
      preload?: string
    }
  }
}
