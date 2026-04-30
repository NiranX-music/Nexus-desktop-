const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const patches = [
  {
    file: path.join(root, 'node_modules', 'extract-file-icon', 'dist', 'index.js'),
    from: /    getIcon = require\("\.\.\/build\/Release\/addon\.node"\)\.getIcon;\r?\n/,
    to:
      '    try {\n' +
      '        getIcon = require("../build/Release/addon.node").getIcon;\n' +
      '    }\n' +
      '    catch {\n' +
      '        getIcon = undefined;\n' +
      '    }\n'
  },
  {
    file: path.join(root, 'node_modules', 'node-window-manager', 'dist', 'index.js'),
    from:
      /    const ADDON_PATH = \(process\.env\.NODE_ENV != "dev"\) \? "Release" : "Debug";\r?\n    exports\.addon = addon = require\(`node-gyp-build`\)\(path_1\.resolve\(__dirname, '\.\.'\)\);\r?\n/,
    to:
      '    const ADDON_PATH = (process.env.NODE_ENV != "dev") ? "Release" : "Debug";\n' +
      '    try {\n' +
      '        exports.addon = addon = require(`node-gyp-build`)(path_1.resolve(__dirname, \'..\'));\n' +
      '    }\n' +
      '    catch {\n' +
      '        exports.addon = addon = undefined;\n' +
      '    }\n'
  }
]

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    console.warn(`Native fallback patch skipped, missing: ${patch.file}`)
    continue
  }

  const current = fs.readFileSync(patch.file, 'utf8')
  if (current.includes(patch.to)) {
    console.log(`Native fallback already patched: ${path.relative(root, patch.file)}`)
    continue
  }

  if (!patch.from.test(current)) {
    console.warn(`Native fallback patch pattern not found: ${path.relative(root, patch.file)}`)
    continue
  }

  fs.writeFileSync(patch.file, current.replace(patch.from, patch.to))
  console.log(`Native fallback patched: ${path.relative(root, patch.file)}`)
}
