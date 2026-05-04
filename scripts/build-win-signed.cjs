const { spawnSync } = require('node:child_process')

const pfxLink = process.env.WIN_CSC_LINK || process.env.CSC_LINK
const pfxPassword = process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD
const certSubjectName = process.env.WINDOWS_CERTIFICATE_SUBJECT_NAME
const certSha1 = process.env.WINDOWS_CERTIFICATE_SHA1

const azureConfig = {
  tenantId: process.env.AZURE_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
  endpoint: process.env.AZURE_TRUSTED_SIGNING_ENDPOINT,
  profileName: process.env.AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME,
  accountName: process.env.AZURE_TRUSTED_SIGNING_CODE_SIGNING_ACCOUNT_NAME,
  publisherName: process.env.AZURE_TRUSTED_SIGNING_PUBLISHER_NAME
}

const hasPfx = Boolean(pfxLink)
const hasCertStore = Boolean(certSubjectName || certSha1)
const hasAzure = Object.values(azureConfig).every(Boolean)
const configuredMethodCount = [hasPfx, hasCertStore, hasAzure].filter(Boolean).length

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (configuredMethodCount === 0) {
  fail(
    [
      'Windows release signing is not configured.',
      '',
      'Set exactly one signing method before running this script:',
      '  - WIN_CSC_LINK or CSC_LINK plus WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD for a .pfx/.p12 certificate',
      '  - WINDOWS_CERTIFICATE_SUBJECT_NAME or WINDOWS_CERTIFICATE_SHA1 for a certificate in the Windows certificate store',
      '  - AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TRUSTED_SIGNING_* values for Microsoft Trusted Signing',
      '',
      'See docs/windows-code-signing.md for the full release checklist.'
    ].join('\n')
  )
}

if (configuredMethodCount > 1) {
  fail('Multiple Windows signing methods are configured. Set only one method for this release build.')
}

if (hasPfx && !pfxPassword) {
  fail('A certificate link is configured, but WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD is missing.')
}

function run(command, args) {
  const executable = process.platform === 'win32' && ['npm', 'npx'].includes(command) ? `${command}.cmd` : command
  const result = spawnSync(executable, args, { stdio: 'inherit' })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

const electronBuilderArgs = ['electron-builder', '--win', '-c.win.forceCodeSigning=true']

if (hasCertStore) {
  if (certSubjectName) {
    electronBuilderArgs.push(`-c.win.signtoolOptions.certificateSubjectName=${certSubjectName}`)
  }

  if (certSha1) {
    electronBuilderArgs.push(`-c.win.signtoolOptions.certificateSha1=${certSha1}`)
  }
}

if (hasAzure) {
  electronBuilderArgs.push(
    `-c.win.azureSignOptions.publisherName=${azureConfig.publisherName}`,
    `-c.win.azureSignOptions.endpoint=${azureConfig.endpoint}`,
    `-c.win.azureSignOptions.certificateProfileName=${azureConfig.profileName}`,
    `-c.win.azureSignOptions.codeSigningAccountName=${azureConfig.accountName}`
  )
}

console.log('Windows release signing configuration detected.')
run('npm', ['run', 'build'])
run('npx', electronBuilderArgs)
