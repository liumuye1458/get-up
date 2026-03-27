import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const failures = []

const requiredLegacyReadme = `This directory is legacy reference code.

- NOT used in runtime
- NOT part of build
- NOT allowed for new development

Current product is PURE WinUI native desktop.
`

function fail(message) {
  failures.push(message)
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
}

async function walk(relativeDir, files = []) {
  const absoluteDir = path.join(root, relativeDir)
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name)
    const normalized = relativePath.replace(/\\/g, '/')

    if (
      normalized.startsWith('node_modules/') ||
      normalized.startsWith('.git/') ||
      normalized.startsWith('legacy/') ||
      normalized.startsWith('release/') ||
      normalized.startsWith('release-winui/') ||
      normalized.startsWith('vendor/') ||
      normalized.startsWith('shell-winui/bin/') ||
      normalized.startsWith('shell-winui/obj/') ||
      normalized.startsWith('shell-winui/artifacts/')
    ) {
      continue
    }

    if (entry.isDirectory()) {
      await walk(relativePath, files)
      continue
    }

    files.push(relativePath)
  }

  return files
}

async function main() {
  const packageJson = await readJson('package.json')
  const scripts = packageJson.scripts ?? {}

  const forbiddenScriptNames = [
    'dev:web',
    'dev:electron',
    'dev:legacy-web',
    'preview',
    'start:electron',
    'dist:electron',
    'build:workspace-web',
  ]

  for (const scriptName of forbiddenScriptNames) {
    if (scriptName in scripts) {
      fail(`Forbidden script still exists: ${scriptName}`)
    }
  }

  for (const requiredScriptName of ['dev:legacy-electron', 'dist:legacy-electron']) {
    if (!(requiredScriptName in scripts)) {
      fail(`Missing required blocked legacy script: ${requiredScriptName}`)
      continue
    }

    if (!String(scripts[requiredScriptName]).includes('block-legacy-runtime.mjs')) {
      fail(`Legacy script must point to block-legacy-runtime.mjs: ${requiredScriptName}`)
    }
  }

  if (packageJson.main !== 'scripts/block-legacy-runtime.mjs') {
    fail('package.json main must point to scripts/block-legacy-runtime.mjs')
  }

  if (existsSync(path.join(root, 'src', 'workspace-web'))) {
    fail('src/workspace-web must not exist. Move it to legacy/workspace-web.')
  }

  if (existsSync(path.join(root, 'shell-winui', 'Bridge', 'WorkspaceBridgeHost.cs'))) {
    fail('shell-winui/Bridge/WorkspaceBridgeHost.cs must not be part of the active WinUI build.')
  }

  if (existsSync(path.join(root, 'dist'))) {
    fail('Root dist/ directory detected. React build output must not exist in the active repository root.')
  }

  if (existsSync(path.join(root, 'electron'))) {
    fail('Root electron/ directory detected. Electron runtime code must stay archived under legacy/.')
  }

  for (const archivedPath of [
    'index.html',
    'vite.config.ts',
    'tsconfig.app.json',
    'tsconfig.json',
    'tsconfig.node.json',
    'public',
  ]) {
    if (existsSync(path.join(root, archivedPath))) {
      fail(`Legacy web build asset must stay archived, not active at repo root: ${archivedPath}`)
    }
  }

  const legacyReadmePath = path.join(root, 'legacy', 'workspace-web', 'README.md')
  if (!existsSync(legacyReadmePath)) {
    fail('legacy/workspace-web/README.md is required.')
  } else {
    const legacyReadme = await readFile(legacyReadmePath, 'utf8')
    if (legacyReadme !== requiredLegacyReadme) {
      fail('legacy/workspace-web/README.md does not match the required locked text.')
    }
  }

  const activeFiles = await walk('.')
  const forbiddenPatterns = [
    {
      pattern: /Microsoft\.Web\.WebView2|WebView2/g,
      message: 'WebView2 runtime dependency detected in active code.',
    },
    {
      pattern: /workspace-web/g,
      message: 'workspace-web reference detected in active code.',
    },
    {
      pattern: /react-dom\/client|WorkspaceWebRoot|VITE_DEV_SERVER_URL|@vitejs\/plugin-react/g,
      message: 'React runtime/build reference detected in active code.',
    },
  ]

  for (const relativePath of activeFiles) {
    const normalized = relativePath.replace(/\\/g, '/')
    if (normalized === 'scripts/enforce-native-architecture.mjs') {
      continue
    }

    const extension = path.extname(normalized).toLowerCase()
    const scannableExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.ps1', '.cs', '.xaml', '.csproj', '.yml', '.yaml'])
    const shouldScan =
      scannableExtensions.has(extension) &&
      (
        normalized.startsWith('scripts/') ||
        normalized.startsWith('shell-winui/') ||
        normalized.startsWith('src/') ||
        normalized.startsWith('.github/')
      )

    if (!shouldScan) {
      continue
    }

    const text = await readFile(path.join(root, relativePath), 'utf8')
    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(text)) {
        fail(`${rule.message} File: ${normalized}`)
      }
      rule.pattern.lastIndex = 0
    }
  }

  const srcEntries = await readdir(path.join(root, 'src'))
  const unexpectedSrcEntries = srcEntries.filter((entry) => entry !== 'README.md')
  if (unexpectedSrcEntries.length > 0) {
    fail(`src/ must stay empty except README.md. Found: ${unexpectedSrcEntries.join(', ')}`)
  }

  if (failures.length > 0) {
    console.error('Native architecture guard failed:')
    for (const message of failures) {
      console.error(`- ${message}`)
    }
    process.exit(1)
  }

  console.log('Native architecture guard passed.')
}

await main()
