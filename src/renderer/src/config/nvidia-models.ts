export type NvidiaModelCategory =
  | 'chat'
  | 'coding'
  | 'reasoning'
  | 'vision'
  | 'speech'
  | 'translation'
  | 'embedding'
  | 'safety'
  | 'image'
  | 'specialized'

export interface NvidiaBuildModel {
  id: string
  provider: string
  name: string
  categories: NvidiaModelCategory[]
  description: string
  endpoint: 'chat' | 'completion' | 'embedding' | 'rerank' | 'visual' | 'speech' | 'specialized'
}

export type NvidiaModelDefaults = Record<
  'chat' | 'coding' | 'reasoning' | 'vision' | 'speech' | 'translation' | 'embedding',
  string
>

export const NVIDIA_DEFAULTS_STORAGE_KEY = 'nexus_nvidia_default_models'
export const NVIDIA_API_KEY_STORAGE_KEY = 'nexus_nvidia_api_key'
export const NEXUS_AI_PROVIDER_MODE_STORAGE_KEY = 'nexus_ai_provider_mode'

export const DEFAULT_NVIDIA_MODEL_DEFAULTS: NvidiaModelDefaults = {
  chat: 'google/gemma-2-2b-it',
  coding: 'qwen/qwen3-coder-480b-a35b-instruct',
  reasoning: 'deepseek-ai/deepseek-v4-pro',
  vision: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  speech: 'nvidia/magpie-tts-multilingual',
  translation: 'nvidia/riva-translate-4b-instruct-v1_1',
  embedding: 'nvidia/nv-embedqa-e5-v5'
}

export const NVIDIA_MODEL_CATEGORIES: Array<{
  id: keyof NvidiaModelDefaults
  label: string
  hint: string
}> = [
  { id: 'chat', label: 'Chat Assistant', hint: 'Default typed AI assistant model.' },
  { id: 'coding', label: 'Coding Agent', hint: 'Code generation, debugging, and agentic coding.' },
  { id: 'reasoning', label: 'Reasoning', hint: 'Hard problems, planning, and long context.' },
  { id: 'vision', label: 'Vision / Omni', hint: 'Image, video, audio, and multimodal tasks.' },
  { id: 'speech', label: 'Speech', hint: 'TTS and ASR model preference for voice workflows.' },
  { id: 'translation', label: 'Translation', hint: 'Neural machine translation preference.' },
  { id: 'embedding', label: 'Embeddings', hint: 'Retrieval, RAG, and semantic search.' }
]

const chat = (id: string, provider: string, name: string, description: string): NvidiaBuildModel => ({
  id,
  provider,
  name,
  description,
  endpoint: 'chat',
  categories: ['chat']
})

const coding = (
  id: string,
  provider: string,
  name: string,
  description: string
): NvidiaBuildModel => ({
  id,
  provider,
  name,
  description,
  endpoint: 'chat',
  categories: ['chat', 'coding']
})

const reasoning = (
  id: string,
  provider: string,
  name: string,
  description: string
): NvidiaBuildModel => ({
  id,
  provider,
  name,
  description,
  endpoint: 'chat',
  categories: ['chat', 'reasoning']
})

export const NVIDIA_BUILD_MODELS: NvidiaBuildModel[] = [
  reasoning(
    'deepseek-ai/deepseek-v4-pro',
    'DeepSeek AI',
    'deepseek-v4-pro',
    '1M-token context MoE model for coding, agents, and hard reasoning.'
  ),
  coding(
    'deepseek-ai/deepseek-v4-flash',
    'DeepSeek AI',
    'deepseek-v4-flash',
    'Fast DeepSeek V4 MoE model optimized for coding and agents.'
  ),
  reasoning(
    'deepseek-ai/deepseek-v3.2',
    'DeepSeek AI',
    'deepseek-v3.2',
    'General chat and reasoning model from DeepSeek.'
  ),
  reasoning(
    'deepseek-ai/deepseek-v3.1-terminus',
    'DeepSeek AI',
    'deepseek-v3.1-terminus',
    'DeepSeek V3.1 Terminus chat and reasoning model.'
  ),
  coding(
    'qwen/qwen3-coder-480b-a35b-instruct',
    'Qwen',
    'qwen3-coder-480b-a35b-instruct',
    'Agentic coding model with long context and browser-use strength.'
  ),
  coding(
    'qwen/qwen2.5-coder-32b-instruct',
    'Qwen',
    'qwen2.5-coder-32b-instruct',
    'Code generation, reasoning, and bug fixing across popular languages.'
  ),
  coding('qwen/qwen2.5-coder-7b-instruct', 'Qwen', 'qwen2.5-coder-7b-instruct', 'Compact coder model.'),
  reasoning('qwen/qwen3-next-80b-a3b-thinking', 'Qwen', 'qwen3-next-80b-a3b-thinking', 'Hybrid reasoning model with thinking support.'),
  chat('qwen/qwen3-next-80b-a3b-instruct', 'Qwen', 'qwen3-next-80b-a3b-instruct', 'Hybrid attention instruction model for ultra-long context AI.'),
  reasoning('qwen/qwen3-5-122b-a10b', 'Qwen', 'qwen3.5-122b-a10b', 'MoE multimodal model for reasoning, coding, and agent workflows.'),
  reasoning('qwen/qwen3-5-397b-a17b', 'Qwen', 'qwen3.5-397b-a17b', 'Large Qwen VLM for vision, chat, RAG, and agentic capabilities.'),
  chat('qwen/qwen2-7b-instruct', 'Qwen', 'qwen2-7b-instruct', 'Instruction tuned Qwen model.'),
  chat('qwen/qwen2.5-7b-instruct', 'Qwen', 'qwen2.5-7b-instruct', 'Compact Qwen instruction model.'),
  reasoning('qwen/qwq-32b', 'Qwen', 'qwq-32b', 'Reasoning-oriented Qwen model.'),
  reasoning('z-ai/glm5.1', 'Z.ai', 'glm-5.1', 'Flagship model for agentic workflows, coding, and long-horizon reasoning.'),
  coding('z-ai/glm4.7', 'Z.ai', 'glm-4.7', 'Multilingual agentic coding partner with tool-use strength.'),
  reasoning('moonshotai/kimi-k2-thinking', 'Moonshot AI', 'kimi-k2-thinking', 'Thinking model for deeper reasoning workflows.'),
  chat('moonshotai/kimi-k2-instruct', 'Moonshot AI', 'kimi-k2-instruct', 'Kimi K2 instruction model.'),
  chat('moonshotai/kimi-k2-instruct-0905', 'Moonshot AI', 'kimi-k2-instruct-0905', 'Updated Kimi K2 instruction model.'),
  reasoning('moonshotai/kimi-k2-5', 'Moonshot AI', 'kimi-k2-5', 'Multimodal Kimi model for agentic and visual tasks.'),
  coding('mistralai/codestral-22b-instruct-v0.1', 'Mistral AI', 'codestral-22b-instruct-v0.1', 'Code-specialized Mistral model.'),
  coding('mistralai/devstral-2-123b-instruct-2512', 'Mistral AI', 'devstral-2-123b-instruct-2512', 'Agentic software engineering model.'),
  reasoning('mistralai/magistral-small-2506', 'Mistral AI', 'magistral-small-2506', 'Reasoning-focused Mistral model.'),
  chat('mistralai/mamba-codestral-7b-v0.1', 'Mistral AI', 'mamba-codestral-7b-v0.1', 'Mamba/Codestral hybrid model.'),
  chat('mistralai/mistral-7b-instruct', 'Mistral AI', 'mistral-7b-instruct', 'Classic Mistral instruction model.'),
  chat('mistralai/mistral-7b-instruct-v0.3', 'Mistral AI', 'mistral-7b-instruct-v0.3', 'Updated Mistral 7B instruction model.'),
  reasoning('mistralai/mistral-large', 'Mistral AI', 'mistral-large', 'Large Mistral model for general reasoning.'),
  chat('mistralai/mistral-nemotron', 'Mistral AI', 'mistral-nemotron', 'Mistral/Nemotron collaboration model.'),
  chat('mistralai/mistral-small-24b-instruct', 'Mistral AI', 'mistral-small-24b-instruct', 'Small instruction model.'),
  chat('mistralai/mistral-medium-3.5-128b', 'Mistral AI', 'mistral-medium-3.5-128b', 'High performance model for text, coding, and agents.'),
  chat('mistralai/mixtral-8x7b-instruct', 'Mistral AI', 'mixtral-8x7b-instruct', 'MoE instruction model.'),
  reasoning('mistralai/mixtral-8x22b-instruct', 'Mistral AI', 'mixtral-8x22b-instruct', 'Larger Mixtral MoE instruction model.'),
  chat('meta/llama-3.3-70b-instruct', 'Meta', 'llama-3.3-70b-instruct', 'Advanced Llama model for reasoning, math, and general knowledge.'),
  chat('meta/llama-3.2-3b-instruct', 'Meta', 'llama-3.2-3b-instruct', 'Small Llama chat model.'),
  chat('meta/llama-3.2-1b-instruct', 'Meta', 'llama-3.2-1b-instruct', 'Tiny Llama instruction model.'),
  reasoning('meta/llama-3.1-70b-instruct', 'Meta', 'llama-3.1-70b-instruct', 'Large Llama 3.1 instruction model.'),
  chat('meta/llama-3.1-8b-instruct', 'Meta', 'llama-3.1-8b-instruct', 'Efficient Llama 3.1 instruction model.'),
  chat('meta/llama3-8b', 'Meta', 'llama3-8b', 'Llama 3 8B chat model.'),
  chat('meta/llama2-70b', 'Meta', 'llama2-70b', 'Llama 2 70B chat model.'),
  chat('openai/gpt-oss-20b', 'OpenAI', 'gpt-oss-20b', 'Open-weight GPT-OSS model.'),
  reasoning('openai/gpt-oss-120b', 'OpenAI', 'gpt-oss-120b', 'Large open-weight GPT-OSS model.'),
  chat('google/gemma-2-2b-it', 'Google', 'gemma-2-2b-it', 'Small generative model for edge applications.'),
  chat('google/gemma-7b', 'Google', 'gemma-7b', 'Gemma model for chat and instruction following.'),
  coding('google/codegemma-7b', 'Google', 'codegemma-7b', 'Gemma code model.'),
  chat('google/shieldgemma-9b', 'Google', 'shieldgemma-9b', 'Safety-focused Gemma model.'),
  chat('microsoft/phi-3-medium-128k-instruct', 'Microsoft', 'phi-3-medium-128k-instruct', 'Phi-3 medium long-context model.'),
  chat('microsoft/phi-3-medium-4k-instruct', 'Microsoft', 'phi-3-medium-4k-instruct', 'Phi-3 medium short-context model.'),
  chat('microsoft/phi-3-mini-128k-instruct', 'Microsoft', 'phi-3-mini-128k-instruct', 'Phi-3 mini long-context model.'),
  chat('microsoft/phi-3-mini-4k-instruct', 'Microsoft', 'phi-3-mini-4k-instruct', 'Phi-3 mini short-context model.'),
  chat('microsoft/phi-3-small-128k-instruct', 'Microsoft', 'phi-3-small-128k-instruct', 'Phi-3 small long-context model.'),
  chat('microsoft/phi-3-small-8k-instruct', 'Microsoft', 'phi-3-small-8k-instruct', 'Phi-3 small instruction model.'),
  chat('microsoft/phi-3.5-mini', 'Microsoft', 'phi-3.5-mini', 'Phi-3.5 mini model.'),
  reasoning('microsoft/phi-4-mini-flash-reasoning', 'Microsoft', 'phi-4-mini-flash-reasoning', 'Compact reasoning model.'),
  chat('microsoft/phi-4-mini-instruct', 'Microsoft', 'phi-4-mini-instruct', 'Phi-4 mini instruction model.'),
  chat('minimaxai/minimax-m2.5', 'MiniMax AI', 'minimax-m2.5', 'MiniMax chat model.'),
  chat('minimaxai/minimax-m2.7', 'MiniMax AI', 'minimax-m2.7', 'MiniMax upgraded chat model.'),
  chat('bytedance/seed-oss-36b-instruct', 'ByteDance', 'seed-oss-36b-instruct', 'Seed OSS instruction model.'),
  chat('abacusai/dracarys-llama-3.1-70b-instruct', 'AbacusAI', 'dracarys-llama-3.1-70b-instruct', 'Llama 3.1 based chat model.'),
  chat('aisingapore/sea-lion-7b-instruct', 'AI Singapore', 'sea-lion-7b-instruct', 'SEA-LION instruction model.'),
  coding('bigcode/starcoder2-7b', 'BigCode', 'starcoder2-7b', 'Code completion model.'),
  chat('marin/marin-8b-instruct', 'Marin', 'marin-8b-instruct', 'Marin instruction model.'),
  chat('opengpt-x/teuken-7b-instruct-commercial-v0.4', 'OpenGPT-X', 'teuken-7b-instruct-commercial-v0.4', 'Commercial Teuken instruction model.'),
  chat('rakuten/rakutenai-7b-chat', 'Rakuten', 'rakutenai-7b-chat', 'Rakuten chat model.'),
  chat('rakuten/rakutenai-7b-instruct', 'Rakuten', 'rakutenai-7b-instruct', 'Rakuten instruction model.'),
  chat('sarvamai/sarvam-m', 'Sarvam AI', 'sarvam-m', 'Indian language model.'),
  chat('stepfun-ai/step-3-5-flash', 'StepFun AI', 'step-3-5-flash', 'Fast Step model.'),
  chat('stockmark/stockmark-2-100b-instruct', 'Stockmark', 'stockmark-2-100b-instruct', 'Enterprise instruction model.'),
  chat('upstage/solar-10.7b-instruct', 'Upstage', 'solar-10.7b-instruct', 'Solar instruction model.'),
  reasoning('nvidia/llama-3.1-nemotron-ultra-253b-v1', 'NVIDIA', 'llama-3.1-nemotron-ultra-253b-v1', 'Large Nemotron reasoning model.'),
  reasoning('nvidia/llama-3.3-nemotron-super-49b-v1.5', 'NVIDIA', 'llama-3.3-nemotron-super-49b-v1.5', 'Nemotron Super updated model.'),
  reasoning('nvidia/llama-3.3-nemotron-super-49b-v1', 'NVIDIA', 'llama-3.3-nemotron-super-49b-v1', 'Nemotron Super model.'),
  chat('nvidia/llama-3.1-nemotron-nano-8b-v1', 'NVIDIA', 'llama-3.1-nemotron-nano-8b-v1', 'Efficient Nemotron Nano model.'),
  chat('nvidia/llama-3.1-nemotron-nano-4b-v1_1', 'NVIDIA', 'llama-3.1-nemotron-nano-4b-v1_1', 'Compact Nemotron Nano model.'),
  chat('nvidia/nemotron-3-nano-30b-a3b', 'NVIDIA', 'nemotron-3-nano-30b-a3b', 'Nemotron 3 Nano chat model.'),
  reasoning('nvidia/nemotron-3-super-120b-a12b', 'NVIDIA', 'nemotron-3-super-120b-a12b', 'Nemotron 3 Super reasoning model.'),
  chat('nvidia/nvidia-nemotron-nano-9b-v2', 'NVIDIA', 'nvidia-nemotron-nano-9b-v2', 'Nemotron Nano v2 model.'),
  chat('nvidia/nemotron-mini-4b-instruct', 'NVIDIA', 'nemotron-mini-4b-instruct', 'Mini instruction model.'),
  chat('nvidia/nemotron-4-mini-hindi-4b-instruct', 'NVIDIA', 'nemotron-4-mini-hindi-4b-instruct', 'Hindi instruction model.'),
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    provider: 'NVIDIA',
    name: 'nemotron-3-nano-omni-30b-a3b-reasoning',
    description: 'Omni-modal reasoning model for image, video, speech, and text understanding.',
    endpoint: 'visual',
    categories: ['chat', 'reasoning', 'vision', 'speech']
  },
  {
    id: 'nvidia/riva-translate-4b-instruct-v1_1',
    provider: 'NVIDIA',
    name: 'riva-translate-4b-instruct-v1_1',
    description: 'Translation model with few-shot prompt support.',
    endpoint: 'chat',
    categories: ['translation', 'chat']
  },
  {
    id: 'nvidia/riva-translate-1.6b',
    provider: 'NVIDIA',
    name: 'riva-translate-1.6b',
    description: 'Neural machine translation model for global interactions.',
    endpoint: 'specialized',
    categories: ['translation']
  },
  {
    id: 'nvidia/megatron-1b-nmt',
    provider: 'NVIDIA',
    name: 'megatron-1b-nmt',
    description: 'Neural machine translation model.',
    endpoint: 'specialized',
    categories: ['translation']
  },
  {
    id: 'nvidia/magpie-tts-multilingual',
    provider: 'NVIDIA',
    name: 'magpie-tts-multilingual',
    description: 'Natural and expressive voices in multiple languages.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/magpie-tts-zeroshot',
    provider: 'NVIDIA',
    name: 'magpie-tts-zeroshot',
    description: 'Text-to-speech voice cloning from a short audio sample.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/parakeet-1.1b-rnnt-multilingual-asr',
    provider: 'NVIDIA',
    name: 'parakeet-1.1b-rnnt-multilingual-asr',
    description: 'Automatic speech recognition for multilingual transcription.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/parakeet-ctc-0.6b-zh-tw',
    provider: 'NVIDIA',
    name: 'parakeet-ctc-0.6b-zh-tw',
    description: 'Mandarin Taiwanese English transcription model.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/parakeet-ctc-0.6b-zh-cn',
    provider: 'NVIDIA',
    name: 'parakeet-ctc-0.6b-zh-cn',
    description: 'Mandarin English transcription model.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/parakeet-ctc-0.6b-es',
    provider: 'NVIDIA',
    name: 'parakeet-ctc-0.6b-es',
    description: 'Spanish English transcription model.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/parakeet-ctc-0.6b-vi',
    provider: 'NVIDIA',
    name: 'parakeet-ctc-0.6b-vi',
    description: 'Vietnamese English transcription model.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/conformer-ctc-asr',
    provider: 'NVIDIA',
    name: 'conformer-ctc-asr',
    description: 'Spanish automatic speech recognition model.',
    endpoint: 'speech',
    categories: ['speech']
  },
  {
    id: 'nvidia/nv-embed-v1',
    provider: 'NVIDIA',
    name: 'nv-embed-v1',
    description: 'Embedding model for text retrieval.',
    endpoint: 'embedding',
    categories: ['embedding']
  },
  {
    id: 'nvidia/nv-embedqa-e5-v5',
    provider: 'NVIDIA',
    name: 'nv-embedqa-e5-v5',
    description: 'Question-answering embedding model for RAG.',
    endpoint: 'embedding',
    categories: ['embedding']
  },
  {
    id: 'nvidia/nv-embedcode-7b-v1',
    provider: 'NVIDIA',
    name: 'nv-embedcode-7b-v1',
    description: 'Code embedding model.',
    endpoint: 'embedding',
    categories: ['embedding', 'coding']
  },
  {
    id: 'nvidia/llama-nemotron-embed-1b-v2',
    provider: 'NVIDIA',
    name: 'llama-nemotron-embed-1b-v2',
    description: 'Nemotron embedding model.',
    endpoint: 'embedding',
    categories: ['embedding']
  },
  {
    id: 'nvidia/llama-nemotron-rerank-1b-v2',
    provider: 'NVIDIA',
    name: 'llama-nemotron-rerank-1b-v2',
    description: 'Passage reranking model.',
    endpoint: 'rerank',
    categories: ['embedding']
  },
  {
    id: 'nvidia/nvclip',
    provider: 'NVIDIA',
    name: 'nvclip',
    description: 'Text/image embedding model.',
    endpoint: 'embedding',
    categories: ['embedding', 'vision']
  },
  {
    id: 'black-forest-labs/flux.1-kontext-dev',
    provider: 'Black Forest Labs',
    name: 'flux.1-kontext-dev',
    description: 'Multimodal image model.',
    endpoint: 'visual',
    categories: ['image', 'vision']
  },
  {
    id: 'black forest labs/flux.1-dev',
    provider: 'Black Forest Labs',
    name: 'flux.1-dev',
    description: 'Image generation model.',
    endpoint: 'visual',
    categories: ['image']
  },
  {
    id: 'black forest labs/flux.1-schnell',
    provider: 'Black Forest Labs',
    name: 'flux.1-schnell',
    description: 'Fast image generation model.',
    endpoint: 'visual',
    categories: ['image']
  },
  {
    id: 'stabilityai/stable-diffusion-xl',
    provider: 'Stability AI',
    name: 'stable-diffusion-xl',
    description: 'Image generation model.',
    endpoint: 'visual',
    categories: ['image']
  },
  {
    id: 'stabilityai/stable-video-diffusion',
    provider: 'Stability AI',
    name: 'stable-video-diffusion',
    description: 'Video generation model.',
    endpoint: 'visual',
    categories: ['image', 'vision']
  },
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    provider: 'Meta',
    name: 'llama-3.2-11b-vision-instruct',
    description: 'Vision-language instruction model.',
    endpoint: 'visual',
    categories: ['vision', 'chat']
  },
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    provider: 'Meta',
    name: 'llama-3.2-90b-vision-instruct',
    description: 'Large vision-language instruction model.',
    endpoint: 'visual',
    categories: ['vision', 'chat']
  },
  {
    id: 'meta/llama-4-maverick-17b-128e-instruct',
    provider: 'Meta',
    name: 'llama-4-maverick-17b-128e-instruct',
    description: 'Multimodal Llama 4 model.',
    endpoint: 'visual',
    categories: ['vision', 'chat', 'reasoning']
  },
  {
    id: 'microsoft/phi-4-multimodal-instruct',
    provider: 'Microsoft',
    name: 'phi-4-multimodal-instruct',
    description: 'Multimodal instruction model.',
    endpoint: 'visual',
    categories: ['vision', 'chat']
  },
  {
    id: 'nvidia/usdcode',
    provider: 'NVIDIA',
    name: 'usdcode',
    description: 'OpenUSD knowledge and USD-Python code generation model.',
    endpoint: 'chat',
    categories: ['specialized', 'coding', 'chat']
  },
  {
    id: 'nvidia/gliner-pii',
    provider: 'NVIDIA',
    name: 'gliner-pii',
    description: 'PII entity extraction model.',
    endpoint: 'specialized',
    categories: ['safety', 'specialized']
  },
  {
    id: 'nvidia/llama-3.1-nemoguard-8b-content-safety',
    provider: 'NVIDIA',
    name: 'llama-3.1-nemoguard-8b-content-safety',
    description: 'Content safety guard model.',
    endpoint: 'chat',
    categories: ['safety', 'chat']
  }
]

export const getNvidiaModelById = (modelId: string) =>
  NVIDIA_BUILD_MODELS.find((model) => model.id === modelId)

export const getModelsForCategory = (category: keyof NvidiaModelDefaults) =>
  NVIDIA_BUILD_MODELS.filter((model) => model.categories.includes(category))

export const getStoredNvidiaModelDefaults = (): NvidiaModelDefaults => {
  try {
    const raw = localStorage.getItem(NVIDIA_DEFAULTS_STORAGE_KEY)
    if (!raw) return DEFAULT_NVIDIA_MODEL_DEFAULTS
    return { ...DEFAULT_NVIDIA_MODEL_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_NVIDIA_MODEL_DEFAULTS
  }
}
