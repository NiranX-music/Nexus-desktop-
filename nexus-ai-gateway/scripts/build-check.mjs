import { access } from 'node:fs/promises'

const required = [
  'api/nvidia/chat.js',
  'api/nvidia/models.js',
  'api/nvidia/status.js',
  'netlify/functions/nvidia-chat.mjs',
  'netlify/functions/nvidia-models.mjs',
  'netlify/functions/nvidia-status.mjs',
  'public/index.html',
  'public/api-edit.html'
]

await Promise.all(required.map((file) => access(file)))
console.log(`Nexus AI gateway build check passed (${required.length} files).`)

