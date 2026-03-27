function nowIso() {
  return new Date().toISOString()
}

function normalizeHotkey(hotkey) {
  return String(hotkey ?? '')
    .trim()
    .toLowerCase()
}

function isWeakHotkey(normalizedHotkey) {
  const hasModifier =
    normalizedHotkey.includes('ctrl+') ||
    normalizedHotkey.includes('alt+') ||
    normalizedHotkey.includes('shift+') ||
    normalizedHotkey.includes('super+')

  const endsWithFunctionKey = /f\d{1,2}$/.test(normalizedHotkey)

  return !hasModifier && !endsWithFunctionKey
}

function getGroupLabel(entry, strategy) {
  if (strategy?.groupingMode === 'tag') {
    return entry.tagNames?.[0] ?? 'Untagged'
  }

  return null
}

function getModifierOrder(strategy) {
  const primaryModifier = strategy?.primaryModifier ?? 'Ctrl+Shift'
  const allModifiers = ['Ctrl+Shift', 'Ctrl+Alt', 'Alt+Shift']

  if (!strategy?.includeAlternateModifiers) {
    return [primaryModifier]
  }

  return [primaryModifier, ...allModifiers.filter((modifier) => modifier !== primaryModifier)]
}

function buildCandidatePool(strategy) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  const functionKeys = Array.from({ length: 12 }, (_, index) => `F${index + 1}`)
  const letters = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('')
  const modifiers = getModifierOrder(strategy)
  const candidates = []

  const groups = [
    strategy?.includeDigits !== false ? digits : [],
    strategy?.includeFunctionKeys !== false ? functionKeys : [],
    strategy?.includeLetters !== false ? letters : [],
  ]

  for (const group of groups) {
    for (const modifier of modifiers) {
      for (const key of group) {
        candidates.push(`${modifier}+${key}`)
      }
    }
  }

  return candidates
}

export const reservedHotkeys = new Set([
  'alt+tab',
  'alt+f4',
  'ctrl+alt+delete',
  'ctrl+shift+esc',
  'super+l',
  'super+d',
  'super+e',
  'super+r',
])

export function collectShortcutDiagnostics(entries) {
  const duplicate = []
  const reserved = []
  const weak = []
  const seen = new Set()

  for (const entry of entries) {
    if (!entry.hotkey) {
      continue
    }

    const normalizedHotkey = normalizeHotkey(entry.hotkey)

    if (seen.has(normalizedHotkey)) {
      duplicate.push(entry.id)
    } else {
      seen.add(normalizedHotkey)
    }

    if (reservedHotkeys.has(normalizedHotkey)) {
      reserved.push(entry.id)
    }

    if (isWeakHotkey(normalizedHotkey)) {
      weak.push(entry.id)
    }
  }

  return {
    duplicateCueIds: duplicate,
    reservedCueIds: reserved,
    weakCueIds: weak,
  }
}

function buildTargetIdSet(diagnostics, scopes) {
  const targetIds = new Set()

  if (scopes.duplicate) {
    for (const cueId of diagnostics.duplicateCueIds ?? []) {
      targetIds.add(cueId)
    }
  }

  if (scopes.failed) {
    for (const cueId of diagnostics.failedCueIds ?? []) {
      targetIds.add(cueId)
    }
  }

  if (scopes.reserved) {
    for (const cueId of diagnostics.reservedCueIds ?? []) {
      targetIds.add(cueId)
    }
  }

  if (scopes.weak) {
    for (const cueId of diagnostics.weakCueIds ?? []) {
      targetIds.add(cueId)
    }
  }

  return targetIds
}

function pickNextCandidate(usedHotkeys, strategy) {
  const candidatePool = buildCandidatePool(strategy)

  for (const candidate of candidatePool) {
    const normalized = normalizeHotkey(candidate)

    if (reservedHotkeys.has(normalized) || usedHotkeys.has(normalized)) {
      continue
    }

    return candidate
  }

  return null
}

function sortTargetEntries(entries, strategy) {
  if (strategy?.groupingMode !== 'tag') {
    return [...entries]
  }

  return [...entries].sort((left, right) => {
    const leftGroup = getGroupLabel(left, strategy) ?? ''
    const rightGroup = getGroupLabel(right, strategy) ?? ''

    if (leftGroup !== rightGroup) {
      return leftGroup.localeCompare(rightGroup)
    }

    return left.name.localeCompare(right.name)
  })
}

export function createShortcutRepairPlan(entries, diagnostics, options) {
  const mode = options?.mode === 'clear' ? 'clear' : 'assign'
  const scopes = {
    duplicate: true,
    failed: true,
    reserved: true,
    weak: true,
    ...(options?.scopes ?? {}),
  }
  const explicitTargetIds = Array.isArray(options?.targetCueIds)
    ? new Set(options.targetCueIds.filter(Boolean))
    : null
  const targetIds =
    explicitTargetIds && explicitTargetIds.size > 0
      ? explicitTargetIds
      : buildTargetIdSet(diagnostics, scopes)

  if (targetIds.size === 0) {
    return []
  }

  const usedHotkeys = new Set(
    entries
      .filter((entry) => !targetIds.has(entry.id))
      .map((entry) => normalizeHotkey(entry.hotkey))
      .filter(Boolean),
  )

  const assignments = []
  const targetEntries = sortTargetEntries(
    entries.filter((entry) => targetIds.has(entry.id)),
    options?.strategy,
  )

  for (const entry of targetEntries) {
    if (mode === 'clear') {
      assignments.push({
        cueId: entry.id,
        name: entry.name,
        hotkey: '',
        groupLabel: getGroupLabel(entry, options?.strategy),
      })
      continue
    }

    const nextHotkey = pickNextCandidate(usedHotkeys, options?.strategy)

    if (!nextHotkey) {
      break
    }

    usedHotkeys.add(normalizeHotkey(nextHotkey))
    assignments.push({
      cueId: entry.id,
      name: entry.name,
      hotkey: nextHotkey,
      groupLabel: getGroupLabel(entry, options?.strategy),
    })
  }

  return assignments
}

export function applyShortcutRepair(db, assignments) {
  const normalizedAssignments = assignments.filter((entry) => entry?.cueId)

  if (normalizedAssignments.length === 0) {
    return 0
  }

  const transaction = db.transaction(() => {
    const statement = db.prepare(`
      UPDATE cue_cards
      SET
        hotkey = @hotkey,
        updated_at = @updatedAt
      WHERE id = @cueId
    `)

    for (const assignment of normalizedAssignments) {
      statement.run({
        cueId: assignment.cueId,
        hotkey: assignment.hotkey,
        updatedAt: nowIso(),
      })
    }
  })

  transaction()
  return normalizedAssignments.length
}
