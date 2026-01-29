import { useState, useEffect } from 'react'
import { getDeviceId } from '../utils/deviceId'

export default function ProjectSidebar({
  onSelectProject,
  onNewProject,
  currentProjectId,
  isCollapsed,
  onToggleCollapse
}) {
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const deviceId = getDeviceId()
      const response = await fetch(`/api/projects?deviceId=${encodeURIComponent(deviceId)}`)
      const data = await response.json()

      if (data.error && data.error !== 'KV not configured') {
        throw new Error(data.error)
      }

      setProjects(data.projects || [])
    } catch (err) {
      console.error('Failed to load projects:', err)
      setError('プロジェクトの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation()

    if (!confirm('このプロジェクトを削除しますか？')) {
      return
    }

    try {
      const deviceId = getDeviceId()
      const response = await fetch(
        `/api/projects/${projectId}?deviceId=${encodeURIComponent(deviceId)}`,
        { method: 'DELETE' }
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Delete failed')
      }

      // Refresh project list
      loadProjects()

      // If deleted project was selected, clear selection
      if (currentProjectId === projectId) {
        onNewProject()
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
      alert('プロジェクトの削除に失敗しました')
    }
  }

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isCollapsed) {
    return (
      <div className="w-12 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-[var(--color-surface-hover)] rounded-lg transition mb-4"
          title="サイドバーを開く"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onNewProject}
          className="p-2 hover:bg-[var(--color-surface-hover)] rounded-lg transition text-[var(--color-primary)]"
          title="新規プロジェクト"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <div className="mt-4 text-xs text-[var(--color-text-muted)] writing-vertical">
          {projects.length}件
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">プロジェクト</h2>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded transition"
            title="サイドバーを閉じる"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="検索..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
          />
        </div>
      </div>

      {/* New Project Button */}
      <div className="p-3">
        <button
          onClick={onNewProject}
          className="w-full py-2.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg font-medium text-sm transition flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新規プロジェクト
        </button>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-[var(--color-primary)]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button
              onClick={loadProjects}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              再試行
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
            {searchTerm ? '検索結果がありません' : 'プロジェクトがありません'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`
                  p-3 rounded-lg cursor-pointer transition group
                  ${currentProjectId === project.id
                    ? 'bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/50'
                    : 'hover:bg-[var(--color-surface-hover)] border border-transparent'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{project.name}</h3>
                    {project.productName && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                        {project.productName}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition"
                    title="削除"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-text-muted)]">
                  {project.imageCount > 0 && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {project.imageCount}
                    </span>
                  )}
                  {project.hasLogo && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      ロゴ
                    </span>
                  )}
                  <span className="ml-auto">{formatDate(project.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        {projects.length}件のプロジェクト
      </div>
    </div>
  )
}
