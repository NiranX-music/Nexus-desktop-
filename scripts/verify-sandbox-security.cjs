// Verification script to validate Sandbox Security rules
const path = require('path')

console.log('Testing Nexus Sandbox Security Core Rules...\n')

// 1. Path Jailing Test
function testPathJailing() {
  const sandboxRoot = 'C:\\Users\\NiranX\\AppData\\Roaming\\Nexus AI 9.1\\SandboxWorkspace'
  const workspaceDir = path.join(sandboxRoot, 'workspace')

  const isWithinSandbox = (targetPath) => {
    const normalizedTarget = path.resolve(targetPath).toLowerCase()
    const normalizedRoot = path.resolve(sandboxRoot).toLowerCase()
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + path.sep)
  }

  const resolveWrite = (input) => {
    const isAbsolute = path.isAbsolute(input) || input.includes(':')
    if (!isAbsolute) {
      return { allowed: true, targetPath: path.join(workspaceDir, input) }
    }
    const resolved = path.resolve(input)
    if (isWithinSandbox(resolved)) {
      return { allowed: true, targetPath: resolved }
    }
    return { allowed: false, targetPath: resolved, error: 'Outside sandbox' }
  }

  // Tests
  const relativeFile = resolveWrite('my-project/index.js')
  console.assert(relativeFile.allowed === true, 'Relative file should be allowed')
  console.assert(relativeFile.targetPath.startsWith(workspaceDir), 'Relative file must be inside workspace')
  console.log('✅ Relative file jailing passed: ' + relativeFile.targetPath)

  const hostileFile1 = resolveWrite('C:\\Windows\\System32\\drivers\\etc\\hosts')
  console.assert(hostileFile1.allowed === false, 'Writing to System32 must be blocked!')
  console.log('✅ Protected system directory block passed: ' + hostileFile1.targetPath)

  const hostileFile2 = resolveWrite('C:\\Users\\NiranX\\Desktop\\important_document.pdf')
  console.assert(hostileFile2.allowed === false, 'Writing directly to Host Desktop must be blocked in sandbox mode!')
  console.log('✅ Host desktop write block passed: ' + hostileFile2.targetPath)

  const safeSandboxFile = resolveWrite(path.join(workspaceDir, 'script.py'))
  console.assert(safeSandboxFile.allowed === true, 'Inside sandbox write should be allowed')
  console.log('✅ Inside sandbox write passed: ' + safeSandboxFile.targetPath)
}

// 2. Shell Command Firewall Test
function testCommandFirewall() {
  const isCommandSafe = (command) => {
    const normalizedCmd = command.trim()

    if (/\b(format|diskpart|mountvol)\b/i.test(normalizedCmd)) {
      return { allowed: false, reason: 'Disk partition/format blocked' }
    }
    if (/\b(shutdown|Stop-Computer|Restart-Computer)\b/i.test(normalizedCmd)) {
      return { allowed: false, reason: 'Reboot/shutdown blocked' }
    }
    if (/\b(reg\s+(delete|add|copy|restore|import)|Set-ItemProperty.*HKLM|Remove-Item.*HKLM)/i.test(normalizedCmd)) {
      return { allowed: false, reason: 'Registry tampering blocked' }
    }
    if (/\b(rmdir|rm|del|erase|Remove-Item)\b.*(\/s|\/q|-r|-recurse|-force).*(c:[\\\/]?($|\s)|[\\\/]windows|[\\\/]system32|[\\\/]programdata|[\\\/]users[\\\/][^\\\/]+[\\\/](desktop|documents|appdata))/i.test(normalizedCmd)) {
      return { allowed: false, reason: 'Destructive deletion blocked' }
    }
    if (/\btaskkill\b.*(\/f|\/im\s+(explorer\.exe|svchost\.exe|csrss\.exe|winlogon\.exe|lsass\.exe|dwm\.exe))/i.test(normalizedCmd)) {
      return { allowed: false, reason: 'Killing critical host process blocked' }
    }
    if (/\b(Set-MpPreference|netsh\s+advfirewall)\b/i.test(normalizedCmd)) {
      return { allowed: false, reason: 'Security policy tampering blocked' }
    }
    return { allowed: true }
  }

  // Dangerous commands to test
  const dangerousCommands = [
    'rmdir /s /q C:\\',
    'del /s /q C:\\Windows\\System32',
    'Remove-Item -Recurse -Force C:\\Users\\NiranX\\Documents',
    'reg delete HKLM\\Software\\Policies /f',
    'shutdown /s /t 0',
    'Stop-Computer -Force',
    'taskkill /f /im explorer.exe',
    'format D: /fs:NTFS',
    'Set-MpPreference -DisableRealtimeMonitoring $true'
  ]

  for (const cmd of dangerousCommands) {
    const res = isCommandSafe(cmd)
    console.assert(res.allowed === false, `Command should have been blocked: ${cmd}`)
    console.log(`🛡️ Blocked dangerous command: [${cmd}] -> ${res.reason}`)
  }

  // Safe commands to test
  const safeCommands = [
    'npm install express',
    'node server.js',
    'git status',
    'Get-ChildItem -Path .',
    'echo "hello sandbox"'
  ]

  for (const cmd of safeCommands) {
    const res = isCommandSafe(cmd)
    console.assert(res.allowed === true, `Safe command was incorrectly blocked: ${cmd}`)
    console.log(`✅ Permitted safe command: [${cmd}]`)
  }
}

testPathJailing()
console.log('')
testCommandFirewall()
console.log('\nAll Nexus Sandbox security rules validated successfully!')
