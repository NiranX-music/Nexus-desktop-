import { generatePuterImage } from '@renderer/services/nexus-puter-api'
import { InferenceClient } from '@huggingface/inference'

export const handleImageGeneration = async (prompt: string, model: string = 'puter-txt2img') => {
  const loadingEvent = new CustomEvent('image-gen', {
    detail: { prompt: prompt, loading: true, url: '' }
  })
  window.dispatchEvent(loadingEvent)

  // 1. Primary Preference: Puter.js AI Art Engine (Free, Sovereign, Zero-Card)
  try {
    const res = await generatePuterImage(prompt)

    const successEvent = new CustomEvent('image-gen', {
      detail: {
        url: res.objectUrl,
        prompt: prompt,
        loading: false,
        error: false,
        provider: 'puter',
        model: res.modelUsed || model
      }
    })
    window.dispatchEvent(successEvent)

    return `Visual generated successfully using Puter AI Art Engine.`
  } catch (puterError: any) {
    console.warn(
      '[ImageGenerator] Puter AI generation attempt failed, checking fallback:',
      puterError?.message || puterError
    )

    // 2. Secondary Fallback: Hugging Face (if user configured HF key)
    try {
      const HF_API_KEY = localStorage.getItem('nexus_hf_api_key') || ''
      if (HF_API_KEY.trim()) {
        const client = new InferenceClient(HF_API_KEY)
        const imageBlob: any = await (client as any).textToImage({
          model: 'black-forest-labs/FLUX.1-schnell',
          inputs: prompt
        })

        const imageUrl = URL.createObjectURL(imageBlob)
        const successEvent = new CustomEvent('image-gen', {
          detail: {
            url: imageUrl,
            prompt: prompt,
            loading: false,
            error: false,
            provider: 'huggingface',
            model: 'FLUX.1-schnell'
          }
        })
        window.dispatchEvent(successEvent)
        return `Visual generated successfully using Hugging Face FLUX fallback.`
      }
    } catch (hfError: any) {
      console.warn('[ImageGenerator] HF fallback also failed:', hfError)
    }

    // Report error
    let errorMessage = puterError?.message || 'Art generation failed.'
    if (errorMessage.includes('503') || errorMessage.includes('loading')) {
      errorMessage = 'Model is warming up. Please try again in a few seconds.'
    }

    const errorEvent = new CustomEvent('image-gen', {
      detail: {
        url: '',
        prompt: prompt,
        loading: false,
        error: true,
        errorMessage: errorMessage
      }
    })
    window.dispatchEvent(errorEvent)

    return `Generation failed: ${errorMessage}`
  }
}
