export type GeminiModelCategory =
  | 'Text-out models'
  | 'Agent & Research'
  | 'Vision & Media'
  | 'Live API'
  | 'Speech & Audio'
  | 'Embeddings'

export type GeminiModelOption = {
  id: string
  label: string
  category: GeminiModelCategory
  limits: string
  live: boolean
}

export const DEFAULT_GEMINI_MODEL = 'models/gemini-3.8-flash'
export const DEFAULT_LIVE_GEMINI_MODEL = 'models/gemini-3.8-live'

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  // Flagship Text & Multimodal Reasoning Models
  {
    id: 'models/gemini-3.8-flash',
    label: 'Gemini 3.8 Flash (Latest Flagship)',
    category: 'Text-out models',
    limits: 'RPM 15 / TPM 1M / RPD 1,500',
    live: false
  },
  {
    id: 'models/gemini-3.7-flash',
    label: 'Gemini 3.7 Flash (Hybrid Reasoning)',
    category: 'Text-out models',
    limits: 'RPM 15 / TPM 1M / RPD 1,500',
    live: false
  },
  {
    id: 'models/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview (Coding & Reasoning)',
    category: 'Text-out models',
    limits: 'RPM 5 / TPM 500K / RPD 50',
    live: false
  },
  {
    id: 'models/gemini-3.1-pro-preview-customtools',
    label: 'Gemini 3.1 Pro (Custom Tools)',
    category: 'Text-out models',
    limits: 'RPM 5 / TPM 500K / RPD 50',
    live: false
  },
  {
    id: 'models/gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    category: 'Text-out models',
    limits: 'RPM 15 / TPM 1M / RPD 1,500',
    live: false
  },
  {
    id: 'models/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    category: 'Text-out models',
    limits: 'RPM 15 / TPM 1M / RPD 1,500',
    live: false
  },
  {
    id: 'models/gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite (Ultra Fast)',
    category: 'Text-out models',
    limits: 'RPM 30 / TPM 1M / RPD 2,000',
    live: false
  },
  {
    id: 'models/gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    category: 'Text-out models',
    limits: 'RPM 30 / TPM 1M / RPD 2,000',
    live: false
  },
  {
    id: 'models/gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite Preview',
    category: 'Text-out models',
    limits: 'RPM 30 / TPM 1M / RPD 2,000',
    live: false
  },
  {
    id: 'models/gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    category: 'Text-out models',
    limits: 'RPM 15 / TPM 1M / RPD 1,500',
    live: false
  },
  {
    id: 'models/gemini-3-pro-preview',
    label: 'Gemini 3 Pro Preview',
    category: 'Text-out models',
    limits: 'RPM 5 / TPM 500K / RPD 50',
    live: false
  },
  {
    id: 'models/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    category: 'Text-out models',
    limits: 'RPM 5 / TPM 500K / RPD 50',
    live: false
  },

  // Agentic & Deep Research Models
  {
    id: 'models/antigravity-preview-latest',
    label: 'Antigravity Agent Preview Latest',
    category: 'Agent & Research',
    limits: 'Autonomous Agentic Execution',
    live: false
  },
  {
    id: 'models/antigravity-preview-09-2026',
    label: 'Antigravity Agent Preview (09-2026)',
    category: 'Agent & Research',
    limits: 'Autonomous Agentic Execution',
    live: false
  },
  {
    id: 'models/deep-research-max-preview-04-2026',
    label: 'Deep Research Max Preview',
    category: 'Agent & Research',
    limits: 'Extended Chain-of-Thought & Web Grounding',
    live: false
  },
  {
    id: 'models/deep-research-preview-04-2026',
    label: 'Deep Research Preview',
    category: 'Agent & Research',
    limits: 'Autonomous Deep Web & Technical Search',
    live: false
  },
  {
    id: 'models/deep-research-pro-preview-12-2025',
    label: 'Deep Research Pro Preview',
    category: 'Agent & Research',
    limits: 'Deep Multi-Hop Synthesis',
    live: false
  },
  {
    id: 'models/gemini-2.5-computer-use-preview-10-2025',
    label: 'Gemini 2.5 Computer Use Preview',
    category: 'Agent & Research',
    limits: 'OS Screen & Input Automation',
    live: false
  },
  {
    id: 'models/gemini-robotics-er-2-preview',
    label: 'Gemini Robotics-ER 2 Preview',
    category: 'Agent & Research',
    limits: 'Spatial & Physical World Reasoning',
    live: false
  },
  {
    id: 'models/gemini-omni-1.1-flash',
    label: 'Gemini Omni 1.1 Flash',
    category: 'Agent & Research',
    limits: 'Multimodal Video & Tool Agent',
    live: false
  },

  // Vision & Media Generation
  {
    id: 'models/gemini-3-pro-image',
    label: 'Nano Banana Pro (Gemini 3 Pro Image)',
    category: 'Vision & Media',
    limits: 'High-Fidelity Visual Reasoning & Image Gen',
    live: false
  },
  {
    id: 'models/gemini-3.1-flash-image',
    label: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    category: 'Vision & Media',
    limits: 'Real-Time Image Synthesis',
    live: false
  },
  {
    id: 'models/gemini-3.1-flash-lite-image',
    label: 'Nano Banana 2 Lite',
    category: 'Vision & Media',
    limits: 'Low-Latency Visual Generation',
    live: false
  },
  {
    id: 'models/veo-3.1-generate-preview',
    label: 'Veo 3.1 Video Preview',
    category: 'Vision & Media',
    limits: 'High-Resolution Generative Video',
    live: false
  },
  {
    id: 'models/veo-3.1-fast-generate-preview',
    label: 'Veo 3.1 Fast Video Preview',
    category: 'Vision & Media',
    limits: 'Fast Generative Video',
    live: false
  },

  // Live Bidirectional Streaming API (bidiGenerateContent)
  {
    id: 'models/gemini-3.8-live',
    label: 'Gemini 3.8 Live (Recommended Realtime)',
    category: 'Live API',
    limits: 'Sub-60ms Bidi Audio Streaming',
    live: true
  },
  {
    id: 'models/gemini-3.8-live-extended-thinking',
    label: 'Gemini 3.8 Live Extended Thinking',
    category: 'Live API',
    limits: 'Bidi Audio + Realtime Reasoning',
    live: true
  },
  {
    id: 'models/gemini-3.1-flash-live-preview',
    label: 'Gemini 3.1 Flash Live Preview',
    category: 'Live API',
    limits: 'Bidi Audio Streaming',
    live: true
  },
  {
    id: 'models/gemini-3.5-transcribe-live',
    label: 'Gemini 3.5 Transcribe Live',
    category: 'Live API',
    limits: 'Realtime Audio Transcription',
    live: true
  },
  {
    id: 'models/gemini-3.5-live-translate-preview',
    label: 'Gemini 3.5 Live Translate Preview',
    category: 'Live API',
    limits: 'Realtime Speech-to-Speech Translation',
    live: true
  },
  {
    id: 'models/gemini-2.5-flash-native-audio-latest',
    label: 'Gemini 2.5 Flash Native Audio Latest',
    category: 'Live API',
    limits: 'Legacy Native Audio Bidi',
    live: true
  },

  // Speech & Audio (TTS / Transcription)
  {
    id: 'models/gemini-3.8-flash-tts',
    label: 'Gemini 3.8 Flash TTS',
    category: 'Speech & Audio',
    limits: 'Neural Speech Generation',
    live: false
  },
  {
    id: 'models/gemini-3.8-flash-lite-tts',
    label: 'Gemini 3.8 Flash Lite TTS',
    category: 'Speech & Audio',
    limits: 'Fast Neural Voice Synthesis',
    live: false
  },
  {
    id: 'models/gemini-3.1-flash-tts-preview',
    label: 'Gemini 3.1 Flash TTS Preview',
    category: 'Speech & Audio',
    limits: 'Experimental Voice Synthesis',
    live: false
  },
  {
    id: 'models/gemini-3.5-transcribe',
    label: 'Gemini 3.5 Transcribe',
    category: 'Speech & Audio',
    limits: 'High-Accuracy Audio Transcription',
    live: false
  },

  // Embeddings
  {
    id: 'models/gemini-embedding-2',
    label: 'Gemini Embedding 2 (Multimodal)',
    category: 'Embeddings',
    limits: 'Multimodal Vector Representations',
    live: false
  },
  {
    id: 'models/gemini-embedding-2-preview',
    label: 'Gemini Embedding 2 Preview',
    category: 'Embeddings',
    limits: 'Multimodal Vector Representations',
    live: false
  },
  {
    id: 'models/gemini-embedding-001',
    label: 'Gemini Embedding 001',
    category: 'Embeddings',
    limits: 'Text Embeddings',
    live: false
  }
]

export const LIVE_GEMINI_MODEL_IDS = new Set(
  GEMINI_MODEL_OPTIONS.filter((model) => model.live).map((model) => model.id)
)

export const normalizeGeminiLiveModel = (model: string | null) =>
  model && LIVE_GEMINI_MODEL_IDS.has(model) ? model : DEFAULT_LIVE_GEMINI_MODEL

export const getGeminiModelLabel = (id: string) =>
  GEMINI_MODEL_OPTIONS.find((model) => model.id === id)?.label || id
