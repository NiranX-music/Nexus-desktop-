import { app, IpcMain, shell } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const LANCE_REPO_URL = 'https://github.com/bytedance/Lance.git'
const WORKSPACE_LANCE_PATH = path.resolve(process.cwd(), 'External models', 'Lance')

type LanceGeneratePayload = {
  repoPath?: string
  modelPath?: string
  prompt?: string
  height?: number
  width?: number
  frames?: number
  seed?: number
  steps?: number
  cfgScale?: number
}

const cleanPath = (value?: string) => String(value || '').trim().replace(/^['"]|['"]$/g, '')

const defaultRepoPath = () => {
  if (fs.existsSync(WORKSPACE_LANCE_PATH)) return WORKSPACE_LANCE_PATH
  return path.join(app.getPath('userData'), 'External models', 'Lance')
}

const resolveRepoPath = (input?: string) => path.resolve(cleanPath(input) || defaultRepoPath())

const hasLanceRepo = (repoPath: string) =>
  fs.existsSync(path.join(repoPath, 'inference_lance.py')) &&
  fs.existsSync(path.join(repoPath, 'inference_lance.sh')) &&
  fs.existsSync(path.join(repoPath, 'config', 'examples', 't2v_example.json'))

const commandExists = (command: string) =>
  new Promise<boolean>((resolve) => {
    const probe = spawn(process.platform === 'win32' ? 'where' : 'which', [command], { shell: true })
    probe.on('close', (code) => resolve(code === 0))
    probe.on('error', () => resolve(false))
  })

const runCommand = (
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {}
) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: process.platform === 'win32'
    })
    let stdout = ''
    let stderr = ''
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill()
          reject(new Error(`${command} timed out.`))
        }, options.timeoutMs)
      : null

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout)
      resolve({ code, stdout, stderr })
    })
  })

const writePromptJson = (repoPath: string, prompt: string) => {
  const dir = path.join(repoPath, '.nexus', 'requests')
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `t2v_${Date.now()}.json`)
  fs.writeFileSync(filePath, JSON.stringify({ '000000.mp4': prompt }, null, 2), 'utf8')
  return filePath
}

const toBashPath = (targetPath: string) => {
  const normalized = targetPath.replaceAll('\\', '/')
  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (driveMatch) return `/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
  return normalized
}

const writeRunScript = (repoPath: string, payload: Required<LanceGeneratePayload>, promptFile: string) => {
  const saveDir = path.join(repoPath, 'results', `nexus_t2v_${Date.now()}`)
  fs.mkdirSync(saveDir, { recursive: true })
  const scriptPath = path.join(repoPath, '.nexus', `run_t2v_${Date.now()}.sh`)
  const bashModelPath = toBashPath(
    path.isAbsolute(payload.modelPath) ? payload.modelPath : path.join(repoPath, payload.modelPath)
  )
  const bashPromptFile = toBashPath(promptFile)
  const bashSaveDir = toBashPath(saveDir)
  const script = `#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"
source "$SCRIPT_DIR/benchmarks/sample_env.sh"
NUM_GPUS="\${NUM_GPUS:-1}"
VALIDATION_TIMESTEP_SHIFT="\${VALIDATION_TIMESTEP_SHIFT:-3.5}"
USE_KVCACHE="\${USE_KVCACHE:-true}"
lance_setup_common_env
lance_setup_distributed_env "$NUM_GPUS"
lance_setup_shard_env 1
SAVE_PATH_GEN="${bashSaveDir}"
accelerate launch \\
  --num_machines "$NUM_MACHINES" \\
  --num_processes "$TOTAL_RANK" \\
  --machine_rank "$MACHINE_RANK" \\
  --main_process_ip "$MAIN_PROCESS_IP" \\
  --main_process_port "$MAIN_PROCESS_PORT" \\
  --mixed_precision bf16 \\
  inference_lance.py \\
  --model_path "${bashModelPath}" \\
  --vit_type qwen_2_5_vl_original \\
  --llm_qk_norm true \\
  --llm_qk_norm_und true \\
  --llm_qk_norm_gen true \\
  --tie_word_embeddings false \\
  --validation_num_timesteps ${payload.steps} \\
  --validation_timestep_shift "$VALIDATION_TIMESTEP_SHIFT" \\
  --copy_init_moe true \\
  --max_num_frames 121 \\
  --max_latent_size 64 \\
  --latent_patch_size 1 1 1 \\
  --visual_und true \\
  --visual_gen true \\
  --vae_model_type wan \\
  --apply_qwen_2_5_vl_pos_emb true \\
  --apply_chat_template false \\
  --cfg_type 0 \\
  --validation_data_seed ${payload.seed} \\
  --video_height ${payload.height} \\
  --video_width ${payload.width} \\
  --num_frames ${payload.frames} \\
  --task t2v \\
  --save_path_gen "$SAVE_PATH_GEN" \\
  --resolution video_480p \\
  --text_template true \\
  --cfg_text_scale ${payload.cfgScale} \\
  --use_KVcache "$USE_KVCACHE" \\
  --val_dataset_config_file "${bashPromptFile}"
echo "Done! Results: $SAVE_PATH_GEN"
`
  fs.writeFileSync(scriptPath, script, 'utf8')
  return { scriptPath, saveDir }
}

const findNewestVideo = (dir: string): string | null => {
  if (!fs.existsSync(dir)) return null
  const videos = fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  return videos[0] || null
}

export default function registerLanceVideo(ipcMain: IpcMain) {
  ipcMain.handle('lance:status', async (_event, payload: { repoPath?: string; modelPath?: string } = {}) => {
    const repoPath = resolveRepoPath(payload.repoPath)
    const modelPath = cleanPath(payload.modelPath) || 'downloads/Lance_3B_Video'
    const resolvedModelPath = path.isAbsolute(modelPath) ? modelPath : path.join(repoPath, modelPath)
    const [gitAvailable, bashAvailable, pythonAvailable] = await Promise.all([
      commandExists('git'),
      commandExists('bash'),
      commandExists('python')
    ])

    return {
      success: true,
      repoUrl: LANCE_REPO_URL,
      repoPath,
      modelPath,
      resolvedModelPath,
      repoReady: hasLanceRepo(repoPath),
      weightsReady: fs.existsSync(resolvedModelPath),
      gitAvailable,
      bashAvailable,
      pythonAvailable,
      requirements: 'CUDA 12.4+, Python 3.10+, Lance weights from Hugging Face, and a GPU with 40GB+ VRAM.'
    }
  })

  ipcMain.handle('lance:clone', async (_event, payload: { repoPath?: string } = {}) => {
    const repoPath = resolveRepoPath(payload.repoPath)
    if (hasLanceRepo(repoPath)) return { success: true, repoPath, message: 'Lance repo is already present.' }
    fs.mkdirSync(path.dirname(repoPath), { recursive: true })
    const result = await runCommand('git', ['clone', '--depth', '1', LANCE_REPO_URL, repoPath], {
      timeoutMs: 180000
    })
    if (result.code !== 0) {
      return { success: false, repoPath, error: result.stderr || result.stdout || 'Git clone failed.' }
    }
    return { success: true, repoPath, message: 'Lance repo cloned.' }
  })

  ipcMain.handle('lance:generate-video', async (_event, rawPayload: LanceGeneratePayload = {}) => {
    const repoPath = resolveRepoPath(rawPayload.repoPath)
    if (!hasLanceRepo(repoPath)) throw new Error('Lance repo is missing. Clone it from the Video tab first.')

    const payload: Required<LanceGeneratePayload> = {
      repoPath,
      modelPath: cleanPath(rawPayload.modelPath) || 'downloads/Lance_3B_Video',
      prompt: String(rawPayload.prompt || '').trim(),
      height: Number(rawPayload.height || 480),
      width: Number(rawPayload.width || 848),
      frames: Math.min(121, Math.max(1, Number(rawPayload.frames || 50))),
      seed: Number(rawPayload.seed || 42),
      steps: Number(rawPayload.steps || 30),
      cfgScale: Number(rawPayload.cfgScale || 4)
    }

    if (!payload.prompt) throw new Error('Enter a video prompt first.')
    const resolvedModelPath = path.isAbsolute(payload.modelPath)
      ? payload.modelPath
      : path.join(repoPath, payload.modelPath)
    if (!fs.existsSync(resolvedModelPath)) {
      throw new Error(`Lance weights are missing at ${resolvedModelPath}.`)
    }

    const promptFile = writePromptJson(repoPath, payload.prompt)
    const { scriptPath, saveDir } = writeRunScript(repoPath, payload, promptFile)
    const result = await runCommand('bash', [scriptPath], { cwd: repoPath })
    const videoPath = findNewestVideo(saveDir)
    return {
      success: result.code === 0,
      repoPath,
      saveDir,
      videoPath,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.code === 0 ? '' : result.stderr || result.stdout || 'Lance generation failed.'
    }
  })

  ipcMain.handle('lance:open-path', async (_event, targetPath: string) => {
    const clean = cleanPath(targetPath)
    if (/^https?:\/\//i.test(clean)) {
      await shell.openExternal(clean)
      return { success: true }
    }
    if (!clean || !fs.existsSync(clean)) return { success: false, error: 'Path not found.' }
    await shell.openPath(clean)
    return { success: true }
  })
}
