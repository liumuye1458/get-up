import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

const BACKUP_FORMAT = 'code-x-soundboard-backup'
const BACKUP_EXTENSION = '.cxsb'
export const BACKUP_MANIFEST_VERSION = 4

function normalizeCatalogList(values) {
  return Array.from(
    new Set(
      (values ?? [])
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

function createManagedPaths(rootPath) {
  return {
    dataRoot: rootPath,
    databasePath: join(rootPath, 'soundboard.db'),
    libraryDir: join(rootPath, 'library'),
    waveformsDir: join(rootPath, 'waveforms'),
    trashDir: join(rootPath, 'trash'),
  }
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function hashJson(value) {
  return hashBuffer(Buffer.from(JSON.stringify(value), 'utf-8'))
}

function derivePasswordKey(password, saltHex) {
  return scryptSync(password, Buffer.from(saltHex, 'hex'), 32)
}

function isPasswordProvided(password) {
  return typeof password === 'string' && password.length > 0
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function removeManagedPayload(paths) {
  await rm(paths.databasePath, { force: true })
  await rm(paths.libraryDir, { recursive: true, force: true })
  await rm(paths.waveformsDir, { recursive: true, force: true })
  await rm(paths.trashDir, { recursive: true, force: true })
}

async function copyManagedPayload(sourcePaths, targetPaths) {
  await mkdir(targetPaths.dataRoot, { recursive: true })

  if (!(await pathExists(sourcePaths.databasePath))) {
    throw new Error(`Backup database is missing: ${sourcePaths.databasePath}`)
  }

  await cp(sourcePaths.databasePath, targetPaths.databasePath, { force: true })

  for (const [sourceDir, targetDir] of [
    [sourcePaths.libraryDir, targetPaths.libraryDir],
    [sourcePaths.waveformsDir, targetPaths.waveformsDir],
    [sourcePaths.trashDir, targetPaths.trashDir],
  ]) {
    if (await pathExists(sourceDir)) {
      await cp(sourceDir, targetDir, { recursive: true, force: true })
    } else {
      await mkdir(targetDir, { recursive: true })
    }
  }
}

export async function replaceManagedPayload(targetPaths, sourcePaths) {
  const rollbackRoot = await mkdtemp(join(tmpdir(), 'local-sfx-board-replace-'))
  const rollbackPaths = createManagedPaths(rollbackRoot)

  await copyManagedPayload(targetPaths, rollbackPaths)

  try {
    await removeManagedPayload(targetPaths)
    await copyManagedPayload(sourcePaths, targetPaths)
  } catch (error) {
    await removeManagedPayload(targetPaths)
    await copyManagedPayload(rollbackPaths, targetPaths)
    throw error
  } finally {
    await rm(rollbackRoot, { recursive: true, force: true })
  }
}

async function collectFiles(rootDir) {
  if (!(await pathExists(rootDir))) {
    return []
  }

  const files = []

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      files.push({
        path: relative(rootDir, fullPath),
        data: (await readFile(fullPath)).toString('base64'),
      })
    }
  }

  await walk(rootDir)
  return files
}

async function materializeFiles(rootDir, files) {
  await mkdir(rootDir, { recursive: true })

  for (const file of files ?? []) {
    const targetPath = join(rootDir, file.path)
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, Buffer.from(file.data, 'base64'))
  }
}

async function readBackupPackage(sourcePath) {
  try {
    const raw = await readFile(sourcePath)
    const jsonBuffer = await gunzipAsync(raw)
    const payload = JSON.parse(jsonBuffer.toString('utf-8'))

    if (payload?.manifest?.format !== BACKUP_FORMAT) {
      throw new Error('Selected file is not a valid Code X Soundboard backup')
    }

    return payload
  } catch (error) {
    const nextError = error instanceof Error ? error : new Error('Backup package is unreadable')
    nextError.name = 'BackupPackageCorruptError'
    throw nextError
  }
}

function buildPlainPayloadData(storagePaths) {
  return Promise.all([
    readFile(storagePaths.databasePath),
    collectFiles(storagePaths.libraryDir),
    collectFiles(storagePaths.waveformsDir),
    collectFiles(storagePaths.trashDir),
  ]).then(([databaseBuffer, libraryFiles, waveformFiles, trashFiles]) => ({
    database: databaseBuffer.toString('base64'),
    libraryFiles,
    waveformFiles,
    trashFiles,
  }))
}

function encryptPayloadData(payloadData, password) {
  const saltHex = randomBytes(16).toString('hex')
  const ivHex = randomBytes(12).toString('hex')
  const key = derivePasswordKey(password, saltHex)
  const cipher = createCipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  const plaintext = Buffer.from(JSON.stringify(payloadData), 'utf-8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTagHex = cipher.getAuthTag().toString('hex')
  const signatureHex = createHmac('sha256', key).update(ciphertext).digest('hex')

  return {
    encryptedPayload: ciphertext.toString('base64'),
    encryption: {
      enabled: true,
      kdf: 'scrypt',
      cipher: 'aes-256-gcm',
      saltHex,
      ivHex,
      authTagHex,
    },
    signature: {
      algorithm: 'hmac-sha256',
      valueHex: signatureHex,
    },
  }
}

function decryptPayloadData(payload, password) {
  const encryption = payload?.manifest?.encryption
  const signature = payload?.manifest?.signature

  if (!encryption?.enabled) {
    return {
      payloadData: {
        database: payload.database,
        libraryFiles: payload.libraryFiles ?? [],
        waveformFiles: payload.waveformFiles ?? [],
        trashFiles: payload.trashFiles ?? [],
      },
      integrity: {
        level: 'ok',
        valid: true,
        reasons: [],
      },
    }
  }

  if (!isPasswordProvided(password)) {
    return {
      payloadData: null,
      integrity: {
        level: 'warning',
        valid: false,
        reasons: [
          {
            code: 'password_required',
            detail: 'Password is required to verify and restore this backup package',
          },
        ],
      },
    }
  }

  try {
    const key = derivePasswordKey(password, encryption.saltHex)
    const encryptedBuffer = Buffer.from(payload.encryptedPayload, 'base64')
    const expectedSignature = Buffer.from(signature.valueHex, 'hex')
    const actualSignature = Buffer.from(createHmac('sha256', key).update(encryptedBuffer).digest('hex'), 'hex')

    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return {
        payloadData: null,
        integrity: {
          level: 'blocked',
          valid: false,
          reasons: [
            {
              code: 'password_or_signature_invalid',
              detail: 'Password is incorrect or encrypted package signature is invalid',
            },
          ],
        },
      }
    }

    const decipher = createDecipheriv(
      encryption.cipher,
      key,
      Buffer.from(encryption.ivHex, 'hex'),
    )
    decipher.setAuthTag(Buffer.from(encryption.authTagHex, 'hex'))
    const plaintextBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])

    return {
      payloadData: JSON.parse(plaintextBuffer.toString('utf-8')),
      integrity: {
        level: 'ok',
        valid: true,
        reasons: [],
      },
    }
  } catch {
    return {
      payloadData: null,
      integrity: {
        level: 'blocked',
        valid: false,
        reasons: [
          {
            code: 'encrypted_payload_corrupt',
            detail: 'Encrypted payload could not be decrypted or authenticated',
          },
        ],
      },
    }
  }
}

function verifyPlainIntegrity(payload) {
  const reasons = []
  const expected = payload?.manifest?.integrity ?? {}

  if (expected.databaseSha256) {
    const actualDatabaseSha256 = hashBuffer(Buffer.from(payload.database, 'base64'))

    if (actualDatabaseSha256 !== expected.databaseSha256) {
      reasons.push({
        code: 'database_checksum_mismatch',
        detail: 'Database payload checksum does not match the backup manifest',
      })
    }
  }

  for (const [key, payloadValue, reasonCode] of [
    ['libraryFilesSha256', payload.libraryFiles, 'library_checksum_mismatch'],
    ['waveformFilesSha256', payload.waveformFiles, 'waveform_checksum_mismatch'],
    ['trashFilesSha256', payload.trashFiles, 'trash_checksum_mismatch'],
  ]) {
    if (!expected[key]) {
      continue
    }

    if (hashJson(payloadValue) !== expected[key]) {
      reasons.push({
        code: reasonCode,
        detail: `${key} does not match the backup manifest`,
      })
    }
  }

  return {
    level: reasons.length > 0 ? 'blocked' : 'ok',
    valid: reasons.length === 0,
    reasons,
  }
}

function verifyBackupPayload(payload, password) {
  if (payload?.manifest?.encryption?.enabled) {
    return decryptPayloadData(payload, password)
  }

  const integrity = verifyPlainIntegrity(payload)

  return {
    payloadData: integrity.valid
      ? {
          database: payload.database,
          libraryFiles: payload.libraryFiles ?? [],
          waveformFiles: payload.waveformFiles ?? [],
          trashFiles: payload.trashFiles ?? [],
        }
      : null,
    integrity,
  }
}

export function createBackupManifest(bootstrap, metadata = {}) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_MANIFEST_VERSION,
    createdAt: new Date().toISOString(),
    schemaVersion: bootstrap.schemaVersion,
    storageMode: bootstrap.storage.mode,
    stats: bootstrap.stats,
    catalog: metadata.catalog
      ? {
          cueNames: normalizeCatalogList(metadata.catalog.cueNames),
          tagNames: normalizeCatalogList(metadata.catalog.tagNames),
          resourceNames: normalizeCatalogList(metadata.catalog.resourceNames),
        }
      : null,
    appVersion: metadata.appVersion ?? null,
    compression: 'gzip+json',
    encryption: {
      enabled: false,
    },
    signature: null,
  }
}

export async function exportBackupBundle(db, storagePaths, targetPath, manifest, options = {}) {
  const resolvedTargetPath = resolve(targetPath)
  const exportRoot = dirname(resolvedTargetPath)
  const activeDataRoot = resolve(storagePaths.dataRoot)

  if (
    resolvedTargetPath === activeDataRoot ||
    resolvedTargetPath.startsWith(`${activeDataRoot}\\`) ||
    exportRoot === activeDataRoot ||
    exportRoot.startsWith(`${activeDataRoot}\\`)
  ) {
    throw new Error('Backup destination cannot be inside the active data directory')
  }

  await mkdir(exportRoot, { recursive: true })
  db.exec('PRAGMA wal_checkpoint(FULL)')

  const normalizedTargetPath = resolvedTargetPath.endsWith(BACKUP_EXTENSION)
    ? resolvedTargetPath
    : `${resolvedTargetPath}${BACKUP_EXTENSION}`
  const payloadData = await buildPlainPayloadData(storagePaths)
  const password = options?.password?.trim?.() ?? ''

  let packagedManifest = {
    ...manifest,
  }
  let packagedPayload

  if (isPasswordProvided(password)) {
    const protectedPayload = encryptPayloadData(payloadData, password)

    packagedManifest = {
      ...packagedManifest,
      encryption: protectedPayload.encryption,
      signature: protectedPayload.signature,
      integrity: null,
    }
    packagedPayload = {
      manifest: packagedManifest,
      encryptedPayload: protectedPayload.encryptedPayload,
    }
  } else {
    packagedManifest = {
      ...packagedManifest,
      encryption: {
        enabled: false,
      },
      signature: null,
      integrity: {
        databaseSha256: hashBuffer(Buffer.from(payloadData.database, 'base64')),
        libraryFilesSha256: hashJson(payloadData.libraryFiles),
        waveformFilesSha256: hashJson(payloadData.waveformFiles),
        trashFilesSha256: hashJson(payloadData.trashFiles),
      },
    }
    packagedPayload = {
      manifest: packagedManifest,
      ...payloadData,
    }
  }

  const compressed = await gzipAsync(Buffer.from(JSON.stringify(packagedPayload), 'utf-8'))
  await writeFile(normalizedTargetPath, compressed)

  return {
    targetPath: normalizedTargetPath,
    manifest: packagedManifest,
  }
}

export async function readBackupManifest(sourcePath) {
  const payload = await readBackupPackage(sourcePath)
  return payload.manifest
}

export async function inspectBackupPackage(sourcePath, password = '') {
  try {
    const payload = await readBackupPackage(sourcePath)
    const verification = verifyBackupPayload(payload, password)

    return {
      manifest: payload.manifest,
      integrity: verification.integrity,
    }
  } catch (error) {
    return {
      manifest: null,
      integrity: {
        level: 'blocked',
        valid: false,
        reasons: [
          {
            code: 'package_corrupt',
            detail: error instanceof Error ? error.message : 'Backup package is unreadable',
          },
        ],
      },
    }
  }
}

function buildCatalogDiffGroup(currentValues, backupValues) {
  const currentSet = new Set(normalizeCatalogList(currentValues))
  const backupSet = new Set(normalizeCatalogList(backupValues))
  const shared = []
  const incomingOnly = []
  const currentOnly = []

  for (const value of backupSet) {
    if (currentSet.has(value)) {
      shared.push(value)
    } else {
      incomingOnly.push(value)
    }
  }

  for (const value of currentSet) {
    if (!backupSet.has(value)) {
      currentOnly.push(value)
    }
  }

  return {
    currentCount: currentSet.size,
    backupCount: backupSet.size,
    sharedCount: shared.length,
    incomingOnlyCount: incomingOnly.length,
    currentOnlyCount: currentOnly.length,
    sharedItems: shared,
    incomingItems: incomingOnly,
    currentOnlyItems: currentOnly,
    incomingSamples: incomingOnly.slice(0, 5),
    currentOnlySamples: currentOnly.slice(0, 5),
  }
}

export function buildBackupDiffSummary(manifest, currentCatalog) {
  if (!manifest?.catalog) {
    return {
      available: false,
      basis: 'name',
      cues: null,
      tags: null,
      resources: null,
    }
  }

  return {
    available: true,
    basis: 'name',
    cues: buildCatalogDiffGroup(currentCatalog?.cueNames, manifest.catalog.cueNames),
    tags: buildCatalogDiffGroup(currentCatalog?.tagNames, manifest.catalog.tagNames),
    resources: buildCatalogDiffGroup(currentCatalog?.resourceNames, manifest.catalog.resourceNames),
  }
}

export function inspectBackupManifest(manifest, currentState) {
  const reasons = []
  let level = 'ok'

  if (manifest.version > currentState.supportedBackupVersion) {
    level = 'blocked'
    reasons.push({
      code: 'backup_format_too_new',
      detail: `Backup format v${manifest.version} is newer than supported v${currentState.supportedBackupVersion}`,
    })
  } else if (manifest.version < currentState.supportedBackupVersion) {
    level = 'warning'
    reasons.push({
      code: 'backup_format_legacy',
      detail: `Backup format v${manifest.version} will be imported into supported v${currentState.supportedBackupVersion}`,
    })
  }

  if (manifest.schemaVersion > currentState.currentSchemaVersion) {
    level = 'blocked'
    reasons.push({
      code: 'schema_too_new',
      detail: `Backup schema v${manifest.schemaVersion} is newer than current schema v${currentState.currentSchemaVersion}`,
    })
  } else if (manifest.schemaVersion < currentState.currentSchemaVersion) {
    if (level === 'ok') {
      level = 'warning'
    }

    reasons.push({
      code: 'schema_legacy',
      detail: `Backup schema v${manifest.schemaVersion} will migrate to v${currentState.currentSchemaVersion}`,
    })
  }

  if (manifest.storageMode !== currentState.currentStorageMode) {
    if (level === 'ok') {
      level = 'warning'
    }

    reasons.push({
      code: 'storage_mode_changed',
      detail: `Backup was created in ${manifest.storageMode} mode and current library is ${currentState.currentStorageMode}`,
    })
  }

  return {
    level,
    blocked: level === 'blocked',
    reasons,
  }
}

export async function restoreBackupBundle(storagePaths, sourcePath, password = '') {
  const payload = await readBackupPackage(sourcePath)
  const verification = verifyBackupPayload(payload, password)

  if (!verification.integrity.valid || !verification.payloadData) {
    throw new Error('Backup package integrity check failed')
  }

  const rollbackRoot = await mkdtemp(join(tmpdir(), 'local-sfx-board-restore-'))
  const rollbackPaths = createManagedPaths(rollbackRoot)

  await copyManagedPayload(storagePaths, rollbackPaths)

  try {
    await removeManagedPayload(storagePaths)
    await mkdir(storagePaths.dataRoot, { recursive: true })
    await writeFile(storagePaths.databasePath, Buffer.from(verification.payloadData.database, 'base64'))
    await materializeFiles(storagePaths.libraryDir, verification.payloadData.libraryFiles)
    await materializeFiles(storagePaths.waveformsDir, verification.payloadData.waveformFiles)
    await materializeFiles(storagePaths.trashDir, verification.payloadData.trashFiles)
  } catch (error) {
    await removeManagedPayload(storagePaths)
    await copyManagedPayload(rollbackPaths, storagePaths)
    throw error
  } finally {
    await rm(rollbackRoot, { recursive: true, force: true })
  }
}

export async function extractBackupBundleToPaths(storagePaths, sourcePath, password = '') {
  const payload = await readBackupPackage(sourcePath)
  const verification = verifyBackupPayload(payload, password)

  if (!verification.integrity.valid || !verification.payloadData) {
    throw new Error('Backup package integrity check failed')
  }

  await removeManagedPayload(storagePaths)
  await mkdir(storagePaths.dataRoot, { recursive: true })
  await writeFile(storagePaths.databasePath, Buffer.from(verification.payloadData.database, 'base64'))
  await materializeFiles(storagePaths.libraryDir, verification.payloadData.libraryFiles)
  await materializeFiles(storagePaths.waveformsDir, verification.payloadData.waveformFiles)
  await materializeFiles(storagePaths.trashDir, verification.payloadData.trashFiles)
}

export function getBackupFileExtension() {
  return BACKUP_EXTENSION
}
