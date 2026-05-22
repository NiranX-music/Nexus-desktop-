export type GeminiModelCategory = 'Text-out models' | 'Live API' | 'Other models'

export type GeminiModelOption = {
  id: string
  label: string
  category: GeminiModelCategory
  limits: string
  live: boolean
}

export const DEFAULT_LIVE_GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-latest'

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  {
    id: 'models/gemini-3-flash',
    label: 'Gemini 3 Flash',
    category: 'Text-out models',
    limits: 'RPM 5 / TPM 250K / RPD 20',
    live: false
  },
  {
    id: 'models/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    category: 'Text-out models',
    limits: 'RPM 5 / TPM 250K / RPD 20',
    live: false
  },
  {
    id: 'models/gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    category: 'Text-out models',
    limits: 'RPM 15 / TPM 250K / RPD 500',
    live: false
  },
  {
    id: 'models/gemini-embedding-001',
    label: 'Gemini Embedding 1',
    category: 'Other models',
    limits: 'RPM 100 / TPM 30K / RPD 1K',
    live: false
  },
  {
    id: 'models/gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    category: 'Text-out models',
    limits: 'RPM 10 / TPM 250K / RPD 20',
    live: false
  },
  {
    id: DEFAULT_LIVE_GEMINI_MODEL,
    label: 'Gemini 2.5 Flash Native Audio Latest',
    category: 'Live API',
    limits: 'Supports bidiGenerateContent',
    live: true
  },
  {
    id: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
    label: 'Gemini 2.5 Flash Native Audio Preview 09-2025',
    category: 'Live API',
    limits: 'Supports bidiGenerateContent',
    live: true
  }
]

export const LIVE_GEMINI_MODEL_IDS = new Set(
  GEMINI_MODEL_OPTIONS.filter((model) => model.live).map((model) => model.id)
)

export const normalizeGeminiLiveModel = (model: string | null) =>
  model && LIVE_GEMINI_MODEL_IDS.has(model) ? model : DEFAULT_LIVE_GEMINI_MODEL

export const getGeminiModelLabel = (id: string) =>
  GEMINI_MODEL_OPTIONS.find((model) => model.id === id)?.label || id
