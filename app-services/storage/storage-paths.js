import { basename, dirname, join } from 'node:path'
import { access, cp, mkdir, rename } from 'node:fs/promises'

export function detectPortableDataRoot({
  env = process.env,
  execPath = process.execPath,
  isPackaged = false,
} = {}) {
  const portableExecutableDir = env.PORTABLE_EXECUTABLE_DIR?.trim()
  const portableExecutableFile = env.PORTABLE_EXECUTABLE_FILE?.trim()

  if (portableExecutableDir) {
    return join(portableExecutableDir, 'data')
  }

  if (portableExecutableFile) {
    return join(dirname(portableExecutableFile), 'data')
  }

  const executableName = basename(execPath ?? '').toLowerCase()
  if (isPackaged && executableName.includes('portable')) {
    return join(dirname(execPath), 'data')
  }

  return null
}

export function getInstalledDataRoot(app) {
  return join(app.getPath('appData'), 'Code X Soundboard')
}

export function createStoragePaths({
  dataRoot,
  mode = 'installed',
}) {
  return {
    mode,
    dataRoot,
    databasePath: join(dataRoot, 'soundboard.db'),
    libraryDir: join(dataRoot, 'library'),
    waveformsDir: join(dataRoot, 'waveforms'),
    trashDir: join(dataRoot, 'trash'),
  }
}

export function getStoragePaths(app) {
  const portableDataRoot = detectPortableDataRoot({ isPackaged: app.isPackaged })
  const dataRoot = portableDataRoot ?? app.getPath('userData')
  const mode = portableDataRoot ? 'portable' : 'installed'

  return createStoragePaths({
    dataRoot,
    mode,
  })
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function moveManagedEntry(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath)) || (await pathExists(targetPath))) {
    return
  }

  try {
    await rename(sourcePath, targetPath)
  } catch {
    await cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: false })
  }
}

export async function migrateLegacyManagedData(app, paths) {
  if (paths.mode !== 'installed') {
    return
  }

  const legacyRoot = join(app.getPath('appData'), 'local-sfx-board')
  if (legacyRoot === paths.dataRoot || !(await pathExists(legacyRoot))) {
    return
  }

  await mkdir(paths.dataRoot, { recursive: true })

  const managedEntries = [
    ['soundboard.db', 'soundboard.db'],
    ['soundboard.db-shm', 'soundboard.db-shm'],
    ['soundboard.db-wal', 'soundboard.db-wal'],
    ['library', 'library'],
    ['waveforms', 'waveforms'],
    ['trash', 'trash'],
  ]

  for (const [sourceName, targetName] of managedEntries) {
    await moveManagedEntry(join(legacyRoot, sourceName), join(paths.dataRoot, targetName))
  }
}

export async function ensureStorageDirectories(paths) {
  await Promise.all([
    mkdir(paths.dataRoot, { recursive: true }),
    mkdir(paths.libraryDir, { recursive: true }),
    mkdir(paths.waveformsDir, { recursive: true }),
    mkdir(paths.trashDir, { recursive: true }),
  ])
}
