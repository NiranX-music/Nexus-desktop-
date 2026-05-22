export type VideoModelProvider = 'lance'

export type VideoGenerationModel = {
  id: string
  label: string
  provider: VideoModelProvider
  mode: 'local'
  repoUrl: string
  requirements: string
}

export const DEFAULT_LANCE_REPO_PATH = 'External models/Lance'

export const DEFAULT_LANCE_MODEL_PATH = 'downloads/Lance_3B_Video'

export const VIDEO_GENERATION_MODELS: VideoGenerationModel[] = [
  {
    id: 'bytedance-lance-3b-video',
    label: 'ByteDance Lance 3B Video',
    provider: 'lance',
    mode: 'local',
    repoUrl: 'https://github.com/bytedance/Lance',
    requirements: 'Local CUDA 12.4+, Python 3.10+, model weights, and 40GB+ VRAM.'
  }
]
