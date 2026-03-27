import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const rootPackage = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'))

const args = new Map()
for (const entry of process.argv.slice(2)) {
  const normalized = entry.replace(/^--/, '')
  const [key, value] = normalized.split('=')
  args.set(key, value ?? true)
}

const runtime = args.get('runtime')

if (runtime !== 'node' && runtime !== 'electron') {
  console.error('Expected --runtime=node or --runtime=electron')
  process.exit(1)
}

const arch = String(args.get('arch') ?? process.arch)
const platform = String(args.get('platform') ?? process.platform)

function normalizeVersion(version) {
  return String(version ?? '').trim().replace(/^[^\d]*/, '')
}

function resolveTargetVersion(selectedRuntime) {
  if (selectedRuntime === 'node') {
    return process.versions.node
  }

  const electronVersion =
    rootPackage.devDependencies?.electron ??
    rootPackage.dependencies?.electron ??
    rootPackage.optionalDependencies?.electron

  const normalized = normalizeVersion(electronVersion)

  if (!normalized) {
    throw new Error('Unable to resolve Electron version from package.json')
  }

  return normalized
}

const target = String(args.get('target') ?? resolveTargetVersion(runtime))
const moduleDir = join(projectRoot, 'node_modules', 'better-sqlite3')
const prebuildInstaller =
  process.platform === 'win32'
    ? join(projectRoot, 'node_modules', '.bin', 'prebuild-install.cmd')
    : join(projectRoot, 'node_modules', '.bin', 'prebuild-install')

if (!existsSync(moduleDir)) {
  throw new Error(`better-sqlite3 module directory not found: ${moduleDir}`)
}

if (!existsSync(prebuildInstaller)) {
  throw new Error(`prebuild-install executable not found: ${prebuildInstaller}`)
}

const installerArgs = [
  `--runtime=${runtime}`,
  `--target=${target}`,
  `--arch=${arch}`,
  `--platform=${platform}`,
  '--verbose',
]

console.log(`[native] syncing better-sqlite3 for runtime=${runtime} target=${target} arch=${arch} platform=${platform}`)

await new Promise((resolve, reject) => {
  const child = spawn(prebuildInstaller, installerArgs, {
    cwd: moduleDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('error', reject)
  child.on('exit', (code) => {
    if (code === 0) {
      resolve()
      return
    }

    reject(new Error(`prebuild-install exited with code ${code ?? 'unknown'}`))
  })
})
