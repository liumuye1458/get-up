import type { ComponentProps } from 'react'
import type { WorkspaceSection } from '../../types'
import {
  BackupAdminSection,
  DiagnosticsAdminSection,
  HistoryAdminSection,
  ResourceAdminSection,
  SettingsAdminSection,
  TagManagerAdminSection,
} from './AdminSections'

type SettingsSectionProps = ComponentProps<typeof SettingsAdminSection>
type HistorySectionProps = ComponentProps<typeof HistoryAdminSection>
type TagManagerSectionProps = ComponentProps<typeof TagManagerAdminSection>
type BackupSectionProps = ComponentProps<typeof BackupAdminSection>
type DiagnosticsSectionProps = ComponentProps<typeof DiagnosticsAdminSection>
type ResourceSectionProps = ComponentProps<typeof ResourceAdminSection>

type AdminWorkspaceContentProps = {
  activeSection: WorkspaceSection
  settingsSection: SettingsSectionProps
  historySection: HistorySectionProps
  tagManagerSection: TagManagerSectionProps
  backupSection: BackupSectionProps
  diagnosticsSection: DiagnosticsSectionProps
  resourceSection: ResourceSectionProps
}

export function AdminWorkspaceContent({
  activeSection,
  settingsSection,
  historySection,
  tagManagerSection,
  backupSection,
  diagnosticsSection,
  resourceSection,
}: AdminWorkspaceContentProps) {
  if (activeSection === 'settings') {
    return <SettingsAdminSection {...settingsSection} />
  }

  if (activeSection === 'tags') {
    return <TagManagerAdminSection {...tagManagerSection} />
  }

  if (activeSection === 'history') {
    return <HistoryAdminSection {...historySection} />
  }

  if (activeSection === 'backup') {
    return <BackupAdminSection {...backupSection} />
  }

  if (activeSection === 'diagnostics') {
    return <DiagnosticsAdminSection {...diagnosticsSection} />
  }

  if (activeSection === 'resources') {
    return <ResourceAdminSection {...resourceSection} />
  }

  return null
}

