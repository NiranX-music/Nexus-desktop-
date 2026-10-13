import { GEMINI_MODEL_OPTIONS } from './gemini-models'

export type AiGatewayProvider =
  | 'puter'
  | 'gemini'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'ollama'
  | 'fireworks'

export type AiGatewayModel = {
  id: string
  label: string
  provider: AiGatewayProvider
}

export const DEFAULT_PUTER_MODELS: AiGatewayModel[] = [
  { provider: 'puter', id: 'gpt-4o', label: 'GPT-4o (OpenAI / Puter)' },
  { provider: 'puter', id: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet (Anthropic / Puter)' },
  { provider: 'puter', id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Anthropic / Puter)' },
  { provider: 'puter', id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (DeepSeek / Puter)' },
  { provider: 'puter', id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google / Puter)' },
  { provider: 'puter', id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (Meta / Puter)' },
  { provider: 'puter', id: 'mistralai/mistral-large-2411', label: 'Mistral Large (Mistral / Puter)' },
  { provider: 'puter', id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B (Alibaba / Puter)' },
  { provider: 'puter', id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano (Fast / Puter Default)' },
  { provider: 'puter', id: 'custom', label: 'Custom Model ID (Puter 500+ Catalog)' }
]

export const DEFAULT_GROQ_MODELS: AiGatewayModel[] = [
  { provider: 'groq', id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
  { provider: 'groq', id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  { provider: 'groq', id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K' },
  { provider: 'groq', id: 'gemma2-9b-it', label: 'Gemma 2 9B IT' }
]

export const DEFAULT_OPENAI_MODELS: AiGatewayModel[] = [
  { provider: 'openai', id: 'gpt-4o', label: 'GPT-4o (Omni Flagship)' },
  { provider: 'openai', id: 'gpt-4o-mini', label: 'GPT-4o Mini (Affordable & Fast)' },
  { provider: 'openai', id: 'o1', label: 'o1 (Deep Reasoning)' },
  { provider: 'openai', id: 'o3-mini', label: 'o3-mini (Reasoning Mini)' }
]

export const DEFAULT_ANTHROPIC_MODELS: AiGatewayModel[] = [
  { provider: 'anthropic', id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Hybrid Thinking)' },
  { provider: 'anthropic', id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (State of the Art)' },
  { provider: 'anthropic', id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Ultra Fast)' }
]

export const DEFAULT_DEEPSEEK_MODELS: AiGatewayModel[] = [
  { provider: 'deepseek', id: 'deepseek-chat', label: 'DeepSeek-V3 (Chat Flagship)' },
  { provider: 'deepseek', id: 'deepseek-reasoner', label: 'DeepSeek-R1 (Chain of Thought Reasoner)' }
]

export const DEFAULT_OLLAMA_MODELS: AiGatewayModel[] = [
  { provider: 'ollama', id: 'llama3.1', label: 'Llama 3.1 (Local)' },
  { provider: 'ollama', id: 'deepseek-coder', label: 'DeepSeek Coder (Local)' },
  { provider: 'ollama', id: 'mistral', label: 'Mistral 7B (Local)' },
  { provider: 'ollama', id: 'phi3', label: 'Phi-3 Mini (Local)' },
  { provider: 'ollama', id: 'custom', label: 'Custom Local Model' }
]

export const DEFAULT_FIREWORKS_MODELS: AiGatewayModel[] = [
  { provider: 'fireworks', id: 'accounts/fireworks/models/kimi-k2p6', label: 'Kimi K2.6' },
  { provider: 'fireworks', id: 'accounts/fireworks/models/glm-5p1', label: 'GLM 5.1' },
  { provider: 'fireworks', id: 'accounts/fireworks/models/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { provider: 'fireworks', id: 'accounts/fireworks/models/gpt-oss-120b', label: 'GPT OSS 120B' }
]

export const DEFAULT_GEMINI_CHAT_MODELS: AiGatewayModel[] = GEMINI_MODEL_OPTIONS.filter(
  (model) => !model.live && model.category !== 'Embeddings'
).map((model) => ({ provider: 'gemini', id: model.id, label: model.label }))

export const DEFAULT_AI_GATEWAY_MODELS: Record<AiGatewayProvider, AiGatewayModel[]> = {
  puter: DEFAULT_PUTER_MODELS,
  gemini: DEFAULT_GEMINI_CHAT_MODELS,
  groq: DEFAULT_GROQ_MODELS,
  openai: DEFAULT_OPENAI_MODELS,
  anthropic: DEFAULT_ANTHROPIC_MODELS,
  deepseek: DEFAULT_DEEPSEEK_MODELS,
  ollama: DEFAULT_OLLAMA_MODELS,
  fireworks: DEFAULT_FIREWORKS_MODELS
}

export const DEFAULT_AI_GATEWAY_MODEL: Record<AiGatewayProvider, string> = {
  puter: 'gpt-4o',
  gemini: 'models/gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-7-sonnet-20250219',
  deepseek: 'deepseek-chat',
  ollama: 'llama3.1',
  fireworks: 'accounts/fireworks/models/kimi-k2p6'
}

export const DEFAULT_AI_GATEWAY_PROVIDER: AiGatewayProvider = 'puter'

export const AI_GATEWAY_PROVIDERS: AiGatewayProvider[] = [
  'puter',
  'gemini',
  'groq',
  'openai',
  'anthropic',
  'deepseek',
  'ollama',
  'fireworks'
]
