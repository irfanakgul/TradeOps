import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { APP_VERSION } from './AppVersion'
import { useAuth } from './AuthContext'

export type ReleaseInfo = {
  id: number
  version: string
  download_url: string
  release_notes_tr?: string | null
  release_notes_en?: string | null
  is_mandatory: boolean
  min_version?: string | null
  sha256?: string | null
  published_at?: string | null
  published_by?: string | null
  is_active: boolean
}

export type UpdateState = {
  currentVersion: string
  latestVersion: string | null
  needsUpdate: boolean
  release: ReleaseInfo | null
  loading: boolean
  dismissed: boolean
  postUpdateNotice: boolean
  dismiss: () => void
  undismiss: () => void
  dismissPostUpdate: () => void
  refresh: () => Promise<void>
}

const UpdateContext = createContext<UpdateState | null>(null)

const POLL_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export function UpdateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [needsUpdate, setNeedsUpdate] = useState(false)
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [postUpdateNotice, setPostUpdateNotice] = useState(false)

  // Detect a post-update launch via the marker the Rust install_update wrote.
  // The Splash also reads this flag, but we need it in context for the toast.
  // We use sessionStorage so we can read it across the multiple consume calls
  // without removing the underlying file twice.
  useEffect(() => {
    const KEY = 'tradeops_post_update'
    if (sessionStorage.getItem(KEY)) {
      setPostUpdateNotice(true)
      return
    }
    ;(async () => {
      try {
        const fromUpdate = await invoke<boolean>('consume_update_marker')
        if (fromUpdate) {
          sessionStorage.setItem(KEY, '1')
          setPostUpdateNotice(true)
        }
      } catch {
        // not running under Tauri
      }
    })()
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ current: APP_VERSION })
      if (user?.username) params.set('username', user.username)
      const res = await fetch(`http://127.0.0.1:8000/api/app/check-update?${params}`)
      const data = await res.json()
      if (res.ok) {
        setLatestVersion(data.latest_version || null)
        setNeedsUpdate(Boolean(data.needs_update))
        setRelease(data.release || null)
      }
    } catch {
      // sessiz geç — backend ulaşılamıyorsa banner çıkmasın
    } finally {
      setLoading(false)
    }
  }, [user?.username])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  // When a new version becomes available, reset dismissal so the banner re-shows
  useEffect(() => {
    setDismissed(false)
  }, [latestVersion])

  const value = useMemo<UpdateState>(
    () => ({
      currentVersion: APP_VERSION,
      latestVersion,
      needsUpdate,
      release,
      loading,
      dismissed,
      postUpdateNotice,
      dismiss: () => setDismissed(true),
      undismiss: () => setDismissed(false),
      dismissPostUpdate: () => setPostUpdateNotice(false),
      refresh,
    }),
    [latestVersion, needsUpdate, release, loading, dismissed, postUpdateNotice, refresh],
  )

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}

export function useUpdate() {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error('useUpdate must be used within UpdateProvider')
  return ctx
}
