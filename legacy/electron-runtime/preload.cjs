const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('desktopApi', {
  getBootstrapSnapshot: () => ipcRenderer.invoke('app:bootstrap'),
  getLibrarySnapshot: () => ipcRenderer.invoke('library:snapshot'),
  importAudioPaths: (paths) => ipcRenderer.invoke('library:import', paths),
  createStarterPack: () => ipcRenderer.invoke('library:createStarterPack'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  updateCue: (cueId, patch) => ipcRenderer.invoke('cue:update', cueId, patch),
  setCueTags: (cueId, tagNames) => ipcRenderer.invoke('cue:setTags', cueId, tagNames),
  batchCueTags: (cueIds, tagNames, mode) => ipcRenderer.invoke('cue:batchTags', cueIds, tagNames, mode),
  reorderCues: (orderedCueIds) => ipcRenderer.invoke('cue:reorder', orderedCueIds),
  deleteCue: (cueId) => ipcRenderer.invoke('cue:delete', cueId),
  updateTagColor: (tagId, color) => ipcRenderer.invoke('tag:updateColor', tagId, color),
  batchUpdateTagColor: (tagIds, color) => ipcRenderer.invoke('tag:batchColor', tagIds, color),
  renameTag: (tagId, nextName) => ipcRenderer.invoke('tag:rename', tagId, nextName),
  deleteTag: (tagId) => ipcRenderer.invoke('tag:delete', tagId),
  batchDeleteTags: (tagIds) => ipcRenderer.invoke('tag:batchDelete', tagIds),
  batchMergeTags: (tagIds, targetName) => ipcRenderer.invoke('tag:batchMerge', tagIds, targetName),
  batchRenameTagsByRule: (tagIds, rule) => ipcRenderer.invoke('tag:batchRenameRule', tagIds, rule),
  cleanupUnusedLibrary: () => ipcRenderer.invoke('library:cleanupUnused'),
  listHistory: () => ipcRenderer.invoke('history:list'),
  undoHistoryEntry: (entryId) => ipcRenderer.invoke('history:undo', entryId),
  getShortcutDiagnostics: () => ipcRenderer.invoke('shortcut:diagnostics'),
  repairShortcutConflicts: (options) => ipcRenderer.invoke('shortcut:bulkRepair', options),
  applyShortcutAssignments: (assignments) => ipcRenderer.invoke('shortcut:applyAssignments', assignments),
  exportLibraryBackup: (password) => ipcRenderer.invoke('library:exportBackup', password),
  previewLibraryBackupImport: () => ipcRenderer.invoke('library:previewBackupImport'),
  importLibraryBackup: (sourcePath, password, selection) =>
    ipcRenderer.invoke('library:importBackup', sourcePath, password, selection),
  exportBackupDiffReport: (payload) => ipcRenderer.invoke('library:exportBackupDiffReport', payload),
  pickAudioFiles: () => ipcRenderer.invoke('files:pickAudio'),
  checkFilesExist: (paths) => ipcRenderer.invoke('files:checkExist', paths),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  onImportProgress: (callback) => {
    const handler = (_, progress) => callback(progress)
    ipcRenderer.on('library:importProgress', handler)

    return () => {
      ipcRenderer.removeListener('library:importProgress', handler)
    }
  },
  onShortcutTriggered: (callback) => {
    const handler = (_, soundId) => callback(soundId)
    ipcRenderer.on('shortcut:trigger', handler)

    return () => {
      ipcRenderer.removeListener('shortcut:trigger', handler)
    }
  },
})
