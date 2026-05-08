const { spawnSync } = require('node:child_process')

const target = process.argv[2] || 'build'
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const env = {
  ...process.env,
  NEXUS_APP_FLAVOR: 'trial',
  VITE_NEXUS_APP_FLAVOR: 'trial'
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

switch (target) {
  case 'dev':
    run(npxCommand, ['electron-vite', 'dev'])
    break
  case 'build':
    run(npmCommand, ['run', 'build'])
    break
  case 'build:unpack':
    run(npmCommand, ['run', 'build'])
    run(npxCommand, ['electron-builder', '--dir', '--config', 'electron-builder-trial.yml'])
    break
  case 'build:win':
    run(npmCommand, ['run', 'build'])
    run(npxCommand, ['electron-builder', '--win', '--config', 'electron-builder-trial.yml'])
    break
  default:
    console.error(`Unknown trial target: ${target}`)
    process.exit(1)
}
