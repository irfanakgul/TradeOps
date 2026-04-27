import { useEffect, useMemo, useState } from 'react'
import AdminPanelLayout from '../../components/AdminPanelLayout'
import { useLanguage } from '../../components/LanguageContext'
import { useAuth } from '../../components/AuthContext'
import { useUpdate } from '../../components/UpdateContext'
import { APP_VERSION } from '../../components/AppVersion'

type Release = {
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

type VersionRow = {
  version: string
  user_count: number
  last_seen?: string | null
}

const EMPTY_FORM = {
  version: '',
  download_url: '',
  release_notes_tr: '',
  release_notes_en: '',
  is_mandatory: false,
  min_version: '',
  sha256: '',
  is_active: true,
}

export default function ReleasesPage() {
  const { language } = useLanguage()
  const { user } = useAuth()
  const { refresh: refreshUpdateBanner } = useUpdate()

  const [releases, setReleases] = useState<Release[]>([])
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // ── Local DMG build state ─────────────────────────────────
  type BuildStatus = {
    running: boolean
    platform: string | null
    started_at: number | null
    finished_at: number | null
    exit_code: number | null
    output_path: string | null
    log_tail: string
  }
  const [build, setBuild] = useState<BuildStatus | null>(null)
  const [buildPanelOpen, setBuildPanelOpen] = useState(false)

  const isAdmin = user?.userType === 'ADMIN'

  function adminParams() {
    return new URLSearchParams({ requesting_user_type: user?.userType || 'CLIENT' })
  }

  async function loadAll() {
    if (!isAdmin) return
    setLoading(true)
    setError('')
    try {
      const [rRel, rVer] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/app/releases?${adminParams()}`),
        fetch(`http://127.0.0.1:8000/api/app/version-distribution?${adminParams()}`),
      ])
      const dataRel = await rRel.json()
      const dataVer = await rVer.json()
      if (rRel.ok) setReleases(dataRel.releases || [])
      else throw new Error(dataRel?.detail?.message || 'Failed to load releases')
      if (rVer.ok) setVersions(dataVer.versions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [user?.userType])

  // Initial build status fetch + poll while a build is running
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function loadStatus() {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/app/build-status')
        if (!res.ok) return
        const data = await res.json() as BuildStatus
        if (cancelled) return
        setBuild(data)
        if (data.running) {
          timer = window.setTimeout(loadStatus, 1500)
        }
      } catch {
        // not fatal
      }
    }
    loadStatus()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [build?.running ? build?.started_at : null])

  async function startBuild(platform: 'apple-silicon' | 'intel' | 'windows') {
    if (!isAdmin) return
    if (build?.running) return
    setError('')
    setBuildPanelOpen(true)
    try {
      const res = await fetch('http://127.0.0.1:8000/api/app/build-dmg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          requesting_user_type: user?.userType || 'CLIENT',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.detail?.message || 'Build start failed')
        return
      }
      // Trigger an immediate poll
      setBuild({
        running: true,
        platform,
        started_at: data.started_at || Date.now() / 1000,
        finished_at: null,
        exit_code: null,
        output_path: null,
        log_tail: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function copyOutputPath() {
    if (!build?.output_path) return
    try {
      await navigator.clipboard.writeText(build.output_path)
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) return
    setSubmitting(true)
    setError('')
    try {
      const body = {
        ...form,
        requesting_username: user?.username || '',
        requesting_user_type: user?.userType || 'CLIENT',
      }
      const url = editingId
        ? `http://127.0.0.1:8000/api/app/releases/${editingId}`
        : 'http://127.0.0.1:8000/api/app/releases'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail?.message || 'Failed')
      setForm({ ...EMPTY_FORM })
      setEditingId(null)
      await loadAll()
      // Trigger immediate update-check so the banner appears right away
      await refreshUpdateBanner()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(rel: Release) {
    if (!isAdmin) return
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/app/releases/${rel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !rel.is_active,
          requesting_user_type: user?.userType || 'CLIENT',
        }),
      })
      if (res.ok) {
        await loadAll()
        await refreshUpdateBanner()
      }
    } catch {
      // sessiz
    }
  }

  async function handleDelete(rel: Release) {
    if (!isAdmin) return
    if (!confirm(language === 'tr' ? `v${rel.version} silinsin mi?` : `Delete v${rel.version}?`)) return
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/app/releases/${rel.id}?${adminParams()}`,
        { method: 'DELETE' },
      )
      if (res.ok) {
        await loadAll()
        await refreshUpdateBanner()
      }
    } catch {
      // sessiz
    }
  }

  function startEdit(rel: Release) {
    setEditingId(rel.id)
    setForm({
      version: rel.version,
      download_url: rel.download_url,
      release_notes_tr: rel.release_notes_tr || '',
      release_notes_en: rel.release_notes_en || '',
      is_mandatory: rel.is_mandatory,
      min_version: rel.min_version || '',
      sha256: rel.sha256 || '',
      is_active: rel.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
  }

  const totalUsers = useMemo(
    () => versions.reduce((acc, v) => acc + (v.user_count || 0), 0),
    [versions],
  )

  if (!isAdmin) {
    return (
      <AdminPanelLayout>
        <div className="admin-page-card">
          <div className="admin-page-title">Releases</div>
          <div className="admin-page-note" style={{ color: '#e53935' }}>
            {language === 'tr' ? 'Bu sayfayı sadece adminler görebilir.' : 'Admin only.'}
          </div>
        </div>
      </AdminPanelLayout>
    )
  }

  return (
    <AdminPanelLayout>
      <div className="admin-page-card">
        <div className="admin-page-title">
          {language === 'tr' ? 'Sürüm Yönetimi' : 'Releases'}
          <span style={{ marginLeft: 12, fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
            {language === 'tr' ? 'Şu anki sürüm:' : 'Current version:'} v{APP_VERSION}
          </span>
        </div>

        {error && <div className="error-box-global">{error}</div>}

        {/* ── Build buttons (creates DMG locally) ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.10em',
            color: '#94a3b8', marginBottom: 10, fontWeight: 700,
          }}>
            {language === 'tr' ? 'Yerel Paketleme' : 'Local Packaging'}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="primary-btn"
              onClick={() => startBuild('apple-silicon')}
              disabled={Boolean(build?.running)}
              title={language === 'tr'
                ? 'Apple Silicon (M-serisi) için DMG paketi üretir. Masaüstüne kaydedilir.'
                : 'Builds an Apple Silicon (M-series) DMG. Saved to Desktop.'}
            >
              {build?.running && build?.platform === 'apple-silicon'
                ? (language === 'tr' ? 'Paketleniyor…' : 'Building…')
                : (language === 'tr' ? '⬢ Apple Silicon DMG' : '⬢ Apple Silicon DMG')}
            </button>

            <button
              type="button"
              className="secondary-btn"
              disabled
              title={language === 'tr' ? 'Yakında' : 'Coming soon'}
            >
              {language === 'tr' ? '⌘ Intel Mac DMG (yakında)' : '⌘ Intel Mac DMG (soon)'}
            </button>

            <button
              type="button"
              className="secondary-btn"
              disabled
              title={language === 'tr' ? 'Yakında' : 'Coming soon'}
            >
              {language === 'tr' ? '⊞ Windows Installer (yakında)' : '⊞ Windows Installer (soon)'}
            </button>

            {build && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setBuildPanelOpen(o => !o)}
                style={{ marginLeft: 'auto' }}
              >
                {buildPanelOpen
                  ? (language === 'tr' ? 'Detayları Gizle' : 'Hide Details')
                  : (language === 'tr' ? 'Detayları Göster' : 'Show Details')}
              </button>
            )}
          </div>

          {/* Status / log panel */}
          {buildPanelOpen && build && (
            <div style={{
              marginTop: 12, padding: 14, borderRadius: 12,
              background: 'rgba(0,0,0,0.32)',
              border: '1px solid rgba(157,184,214,0.14)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem',
                marginBottom: 8,
              }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                  background: build.running
                    ? '#fbc02d'
                    : (build.exit_code === 0 ? '#66bb6a' : '#e53935'),
                  boxShadow: build.running ? '0 0 0 4px rgba(251,192,45,0.20)' : 'none',
                }} />
                <span style={{ fontWeight: 700 }}>
                  {build.running
                    ? (language === 'tr' ? 'Paketleme sürüyor…' : 'Build in progress…')
                    : build.exit_code === 0
                      ? (language === 'tr' ? 'Tamamlandı ✓' : 'Done ✓')
                      : (language === 'tr' ? `Hata (kod ${build.exit_code})` : `Failed (exit ${build.exit_code})`)}
                </span>
                {build.platform && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {build.platform}
                  </span>
                )}
              </div>

              {build.output_path && !build.running && (
                <div style={{
                  marginBottom: 10, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(102, 187, 106, 0.10)',
                  border: '1px solid rgba(102, 187, 106, 0.30)',
                  fontSize: '0.82rem',
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  <span style={{ color: '#81c784', fontWeight: 700 }}>✓</span>
                  <code style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '0.78rem', color: '#cfdaeb',
                    flex: 1, wordBreak: 'break-all',
                  }}>
                    {build.output_path}
                  </code>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={copyOutputPath}
                    style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                  >
                    {language === 'tr' ? 'Kopyala' : 'Copy'}
                  </button>
                </div>
              )}

              <pre style={{
                margin: 0, maxHeight: 320, overflow: 'auto',
                background: 'rgba(0,0,0,0.40)',
                padding: 10, borderRadius: 8,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.74rem', lineHeight: 1.4,
                color: '#b7c7d8', whiteSpace: 'pre-wrap',
              }}>
                {build.log_tail || (language === 'tr' ? 'Log bekleniyor…' : 'Waiting for log…')}
              </pre>
            </div>
          )}
        </div>

        {/* ── Version distribution ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.10em',
            color: '#94a3b8', marginBottom: 10, fontWeight: 700,
          }}>
            {language === 'tr' ? `Kullanıcı Dağılımı (${totalUsers} aktif)` : `Version distribution (${totalUsers} active users)`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {versions.length === 0 ? (
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {language === 'tr' ? 'Veri yok.' : 'No data.'}
              </span>
            ) : (
              versions.map((v) => {
                const pct = totalUsers > 0 ? (v.user_count / totalUsers) * 100 : 0
                return (
                  <div
                    key={v.version}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(157,184,214,0.14)',
                      minWidth: 160,
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {v.version === 'unknown' ? (language === 'tr' ? 'Bilinmeyen' : 'Unknown') : `v${v.version}`}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: 2 }}>
                      {v.user_count}
                    </div>
                    <div style={{ fontSize: '0.70rem', color: '#64b5f6', marginTop: 2 }}>
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Create / Edit form ── */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.10em',
            color: '#94a3b8', marginBottom: 10, fontWeight: 700,
          }}>
            {editingId
              ? (language === 'tr' ? `Sürümü Düzenle (#${editingId})` : `Edit Release (#${editingId})`)
              : (language === 'tr' ? 'Yeni Sürüm Yayınla' : 'Publish New Release')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {language === 'tr' ? 'Sürüm (örn: 1.2.0)' : 'Version (e.g. 1.2.0)'}
              </span>
              <input
                type="text"
                className="trade-config-input"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                required
                placeholder="1.2.0"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {language === 'tr' ? 'İndirme URL (GitHub release DMG linki)' : 'Download URL (GitHub release DMG link)'}
              </span>
              <input
                type="url"
                className="trade-config-input"
                value={form.download_url}
                onChange={(e) => setForm({ ...form, download_url: e.target.value })}
                required
                placeholder="https://github.com/.../TradeOps_1.2.0.dmg"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {language === 'tr' ? 'Sürüm Notları (TR)' : 'Release notes (TR)'}
              </span>
              <textarea
                className="trade-config-input"
                value={form.release_notes_tr}
                onChange={(e) => setForm({ ...form, release_notes_tr: e.target.value })}
                rows={4}
                style={{ height: 'auto', minHeight: 90, resize: 'vertical' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {language === 'tr' ? 'Sürüm Notları (EN)' : 'Release notes (EN)'}
              </span>
              <textarea
                className="trade-config-input"
                value={form.release_notes_en}
                onChange={(e) => setForm({ ...form, release_notes_en: e.target.value })}
                rows={4}
                style={{ height: 'auto', minHeight: 90, resize: 'vertical' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {language === 'tr' ? 'Min. Sürüm (opsiyonel)' : 'Min version (optional)'}
              </span>
              <input
                type="text"
                className="trade-config-input"
                value={form.min_version}
                onChange={(e) => setForm({ ...form, min_version: e.target.value })}
                placeholder="1.0.0"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                SHA-256 ({language === 'tr' ? 'opsiyonel' : 'optional'})
              </span>
              <input
                type="text"
                className="trade-config-input"
                value={form.sha256}
                onChange={(e) => setForm({ ...form, sha256: e.target.value })}
                placeholder="abc123..."
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_mandatory}
                onChange={(e) => setForm({ ...form, is_mandatory: e.target.checked })}
              />
              {language === 'tr' ? 'Zorunlu Güncelleme' : 'Mandatory'}
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              {language === 'tr' ? 'Aktif' : 'Active'}
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting
                ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...')
                : editingId
                  ? (language === 'tr' ? 'Güncelle' : 'Update')
                  : (language === 'tr' ? 'Yayınla' : 'Publish')}
            </button>
            {editingId && (
              <button type="button" className="secondary-btn" onClick={cancelEdit}>
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
            )}
          </div>
        </form>

        {/* ── Releases list ── */}
        <div style={{
          fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.10em',
          color: '#94a3b8', marginBottom: 10, fontWeight: 700,
        }}>
          {language === 'tr' ? 'Yayınlanmış Sürümler' : 'Published releases'}
        </div>

        {loading && <div className="admin-page-note">{language === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {releases.length === 0 && !loading && (
            <div className="admin-page-note">
              {language === 'tr' ? 'Henüz yayınlanmış sürüm yok.' : 'No releases published yet.'}
            </div>
          )}
          {releases.map((rel) => (
            <div
              key={rel.id}
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: rel.is_active
                  ? '1px solid rgba(100,181,246,0.32)'
                  : '1px solid rgba(157,184,214,0.10)',
                opacity: rel.is_active ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                  v{rel.version}
                </span>
                {rel.is_active && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: '0.65rem',
                    background: 'rgba(33,150,243,0.18)', color: '#64b5f6',
                    fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {language === 'tr' ? 'Aktif' : 'Active'}
                  </span>
                )}
                {rel.is_mandatory && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: '0.65rem',
                    background: 'rgba(229,57,53,0.18)', color: '#ff8a80',
                    fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {language === 'tr' ? 'Zorunlu' : 'Mandatory'}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8' }}>
                  {rel.published_at ? new Date(rel.published_at).toLocaleString(language) : '—'}
                  {rel.published_by ? ` · ${rel.published_by}` : ''}
                </span>
              </div>

              <div style={{ marginTop: 6, fontSize: '0.78rem' }}>
                <a href={rel.download_url} target="_blank" rel="noreferrer"
                   style={{ color: '#64b5f6', wordBreak: 'break-all' }}>
                  {rel.download_url}
                </a>
              </div>

              {(rel.release_notes_tr || rel.release_notes_en) && (
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#cfdaeb', whiteSpace: 'pre-wrap' }}>
                  {language === 'tr' ? rel.release_notes_tr : rel.release_notes_en}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" className="secondary-btn" onClick={() => startEdit(rel)}>
                  {language === 'tr' ? 'Düzenle' : 'Edit'}
                </button>
                <button type="button" className="secondary-btn" onClick={() => toggleActive(rel)}>
                  {rel.is_active
                    ? (language === 'tr' ? 'Devre dışı bırak' : 'Deactivate')
                    : (language === 'tr' ? 'Aktif et' : 'Activate')}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  style={{ color: '#ff8a80' }}
                  onClick={() => handleDelete(rel)}
                >
                  {language === 'tr' ? 'Sil' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminPanelLayout>
  )
}
