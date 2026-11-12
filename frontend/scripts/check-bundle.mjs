// Runs after `npm run build`. Fails the build if anything from the local
// .env files (for example the demo sign-in password used for development
// autofill) made it into the production bundle.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const secrets = []
for (const name of ['.env.local', '.env.development.local', '.env.production.local']) {
  const file = path.join(root, name)
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/)
    if (match && match[2].length >= 6) secrets.push([match[1], match[2].replace(/^['"]|['"]$/g, '')])
  }
}

const dist = path.join(root, 'dist')
const files = fs.existsSync(dist)
  ? fs
      .readdirSync(dist, { recursive: true })
      .map((name) => path.join(dist, name))
      .filter((file) => fs.statSync(file).isFile())
  : []
if (!files.length) {
  console.error('Bundle check: no build output in dist/. Run `npm run build` first.')
  process.exit(1)
}

const leaks = []
for (const file of files) {
  const text = fs.readFileSync(file, 'latin1')
  for (const [name, value] of secrets) if (text.includes(value)) leaks.push(`${name} value found in ${path.relative(root, file)}`)
  if (text.includes('VITE_DEMO_PASSWORD')) leaks.push(`reference to VITE_DEMO_PASSWORD in ${path.relative(root, file)}`)
}

if (leaks.length) {
  console.error('Bundle check FAILED: development-only values are in the production build:\n  ' + leaks.join('\n  '))
  process.exit(1)
}
console.log(`Bundle check passed: ${files.length} files scanned, ${secrets.length} local secret value(s) checked, none present.`)
