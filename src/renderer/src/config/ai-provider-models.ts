import { GEMINI_MODEL_OPTIONS } from './gemini-models'

export type AiGatewayProvider = 'gemini' | 'groq' | 'fireworks'

export type AiGatewayModel = {
  id: string
  label: string
  provider: AiGatewayProvider
}

export const DEFAULT_GROQ_MODELS: AiGatewayModel[] = [
  { provider: 'groq', id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
  { provider: 'groq', id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  { provider: 'groq', id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K' },
  { provider: 'groq', id: 'gemma2-9b-it', label: 'Gemma 2 9B IT' }
]

export const DEFAULT_FIREWORKS_MODELS: AiGatewayModel[] = [
  { provider: 'fireworks', id: 'accounts/fireworks/models/kimi-k2p6', label: 'Kimi K2.6' },
  { provider: 'fireworks', id: 'accounts/fireworks/models/glm-5p1', label: 'GLM 5.1' },
  { provider: 'fireworks', id: 'accounts/fireworks/models/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { provider: 'fireworks', id: 'accounts/fireworks/models/gpt-oss-120b', label: 'GPT OSS 120B' }
]

export const DEFAULT_GEMINI_CHAT_MODELS: AiGatewayModel[] = GEMINI_MODEL_OPTIONS.filter(
  (model) => !model.live && model.category !== 'Other models'
).map((model) => ({ provider: 'gemini', id: model.id, label: model.label }))

export const DEFAULT_AI_GATEWAY_MODELS: Record<AiGatewayProvider, AiGatewayModel[]> = {
  gemini: DEFAULT_GEMINI_CHAT_MODELS,
  groq: DEFAULT_GROQ_MODELS,
  fireworks: DEFAULT_FIREWORKS_MODELS
}

export const DEFAULT_AI_GATEWAY_MODEL: Record<AiGatewayProvider, string> = {
  gemini: 'models/gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  fireworks: 'accounts/fireworks/models/kimi-k2p6'
}

export const AI_GATEWAY_PROVIDERS: AiGatewayProvider[] = ['gemini', 'groq', 'fireworks']
