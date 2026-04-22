import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'

type UserPanelData = {
  username: string
  email: string
  first_name: string
  last_name: string
  date_of_birth: string
  mobile_phone: string
  app_lock_password: string
  user_type: string
}

function getPasswordStrength(password: string, language: 'tr' | 'en') {
  if (!password) return ''
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /\d/.test(password)

  if (password.length >= 8 && hasLower && hasUpper && hasDigit) {
    return language === 'tr' ? 'Güçlü şifre' : 'Strong password'
  }
  if (password.length >= 6 && ((hasLower && hasDigit) || (hasUpper && hasDigit))) {
    return language === 'tr' ? 'Orta seviye şifre' : 'Medium password'
  }
  return language === 'tr' ? 'Zayıf şifre' : 'Weak password'
}

export default function UserPanelPage() {
  const { language } = useLanguage()
  const { user, setUser } = useAuth()
  const {
    status,
    startTws,
    stopTws,
    restartTws,
    startServer,
    stopServer,
    restartServer,
    runRuntimeTest,
    stopAll,
  } = useRuntime()

  const [data, setData] = useState<UserPanelData | null>(null)
  const [form, setForm] = useState<UserPanelData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [controlsBusy, setControlsBusy] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')

  const hasUnsavedChanges =
    JSON.stringify(data) !== JSON.stringify(form) ||
    Boolean(newPassword) ||
    Boolean(newPasswordRepeat)

  const passwordStrength = useMemo(
    () => getPasswordStrength(newPassword, language as 'tr' | 'en'),
    [newPassword, language],
  )

  async function runAction(action: () => Promise<any>) {
    if (controlsBusy) return
    try {
      setControlsBusy(true)
      await action()
    } finally {
      window.setTimeout(() => setControlsBusy(false), 2000)
    }
  }

  async function loadUser() {
    if (!user?.username) return

    try {
      setLoading(true)
      setError('')
      const response = await fetch(
        `http://127.0.0.1:8000/api/user-panel?username=${encodeURIComponent(user.username)}`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'User panel failed.')
      }

      setData(result)
      setForm(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  }, [user?.username])

  function updateField(key: keyof UserPanelData, value: string) {
    if (!form) return
    setForm({ ...form, [key]: value })
  }

  async function handleSave() {
    if (!user?.username || !form) return

    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch(
        `http://127.0.0.1:8000/api/user-panel/update?current_username=${encodeURIComponent(user.username)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            password: newPassword,
            password_repeat: newPasswordRepeat,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Save failed.')
      }

      setData(result.user)
      setForm(result.user)
      setNewPassword('')
      setNewPasswordRepeat('')
      setEditMode(false)
      setBanner(language === 'tr' ? 'Bilgiler kaydedildi.' : 'Profile updated.')

      setUser((prev) =>
        prev
          ? {
              ...prev,
              username: result.user.username,
              email: result.user.email,
            }
          : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (!user?.username) return

    try {
      setLoading(true)
      setError('')

      const response = await fetch('http://127.0.0.1:8000/api/user-panel/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          password: deletePassword,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Delete failed.')
      }

      try {
        await stopAll()
      } catch {
        //
      }

      setUser(null)
      window.location.href = '/login'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
      setDeletePassword('')
    }
  }

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      //
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="broker-layout">
        <BrokerSidebar
          activeItem="broker"
          controlsBusy={controlsBusy}
          twsRunning={status.tws_status === 'running'}
          serverRunning={status.server_status === 'running'}
          serverStarting={status.server_status === 'starting'}
          onStartTws={() => runAction(() => startTws())}
          onStopTws={() => runAction(() => stopTws())}
          onRestartTws={() => runAction(() => restartTws())}
          onStartServer={() => runAction(() => startServer())}
          onStopServer={() => runAction(() => stopServer())}
          onRestartServer={() => runAction(() => restartServer())}
          onRuntimeTest={() => runAction(() => runRuntimeTest())}
          onLock={() => {}}
          onExit={handleExit}
        />

        <section className="broker-main wallet-page-main">
          <div className="trade-config-toolbar">
            <button
              type="button"
              className="sidebar-secondary-btn"
              onClick={() => {
                setEditMode((prev) => !prev)
                setForm(data)
                setNewPassword('')
                setNewPasswordRepeat('')
              }}
            >
              {editMode
                ? language === 'tr'
                  ? 'Düzenlemeyi İptal Et'
                  : 'Cancel Edit'
                : 'Edit'}
            </button>

            <button
              type="button"
              className="sidebar-primary-btn"
              disabled={!editMode || !hasUnsavedChanges || loading}
              onClick={handleSave}
            >
              {language === 'tr' ? 'Kaydet' : 'Save'}
            </button>

            <button
              type="button"
              className="sidebar-stop-btn"
              disabled={loading}
              onClick={() => setShowDeleteConfirm(true)}
            >
              {language === 'tr' ? 'Bütün Bilgilerimi Sil' : 'Delete My Account'}
            </button>
          </div>

          {editMode && hasUnsavedChanges && (
            <div className="broker-action-banner">
              {language === 'tr'
                ? 'Kaydedilmemiş değişiklikler var.'
                : 'You have unsaved changes.'}
            </div>
          )}

          {banner && <div className="success-box">{banner}</div>}
          {error && <div className="error-box-global">{error}</div>}
          {loading && (
            <div className="broker-action-banner">
              {language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
            </div>
          )}

          {form && (
            <>
              <div className="trade-config-section-card">
                <div className="trade-config-section-title">
                  {language === 'tr' ? 'Kimlik ve Giriş Bilgileri' : 'Identity and Login Information'}
                </div>

                <div className="trade-config-field-grid">
                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Ad' : 'First Name'}
                    </div>
                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={form.first_name}
                        onChange={(e) => updateField('first_name', e.target.value)}
                      />
                    ) : (
                      <div className="trade-config-value">{form.first_name}</div>
                    )}
                  </div>

                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Soyad' : 'Last Name'}
                    </div>
                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={form.last_name}
                        onChange={(e) => updateField('last_name', e.target.value)}
                      />
                    ) : (
                      <div className="trade-config-value">{form.last_name}</div>
                    )}
                  </div>

                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Kullanıcı Adı' : 'Username'}
                    </div>
                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={form.username}
                        onChange={(e) => updateField('username', e.target.value)}
                      />
                    ) : (
                      <div className="trade-config-value">{form.username}</div>
                    )}
                  </div>

                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Giriş E-posta Adresi' : 'Login Email'}
                    </div>
                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        type="email"
                      />
                    ) : (
                      <div className="trade-config-value">{form.email}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="trade-config-section-card">
                <div className="trade-config-section-title">
                  {language === 'tr' ? 'Kişisel Bilgiler' : 'Personal Information'}
                </div>

                <div className="trade-config-field-grid">
                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Doğum Tarihi' : 'Date of Birth'}
                    </div>
                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={form.date_of_birth}
                        onChange={(e) => updateField('date_of_birth', e.target.value)}
                        type="date"
                      />
                    ) : (
                      <div className="trade-config-value">{form.date_of_birth}</div>
                    )}
                  </div>

                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Telefon' : 'Mobile Phone'}
                    </div>
                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={form.mobile_phone}
                        onChange={(e) => updateField('mobile_phone', e.target.value)}
                        type="text"
                      />
                    ) : (
                      <div className="trade-config-value">{form.mobile_phone}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="trade-config-section-card">
                <div className="trade-config-section-title">
                  {language === 'tr' ? 'Güvenlik Ayarları' : 'Security Settings'}
                </div>

                <div className="trade-config-field-grid">
                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'App Lock Şifresi' : 'App Lock Password'}
                    </div>
                    <div className="trade-config-field-note">
                      {language === 'tr'
                        ? 'Sadece 4 haneli rakamsal değer girin.'
                        : 'Enter numeric 4-digit value only.'}
                    </div>

                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={form.app_lock_password}
                        onChange={(e) =>
                          updateField(
                            'app_lock_password',
                            e.target.value.replace(/\D/g, '').slice(0, 4),
                          )
                        }
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                      />
                    ) : (
                      <div className="trade-config-value">****</div>
                    )}
                  </div>

                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Yeni Kullanıcı Şifresi (en az 8 karakter)' : 'New User Password (atleast 8 character)'}
                    </div>

                    {editMode ? (
                      <>
                        <input
                          className="trade-config-input"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          type="password"
                        />
                        {newPassword && (
                          <div className="trade-config-field-note password-strength-note">
                            {passwordStrength}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="trade-config-value">********</div>
                    )}
                  </div>

                  <div className="trade-config-field-card">
                    <div className="trade-config-field-label">
                      {language === 'tr' ? 'Yeni Şifre Tekrar' : 'Repeat New Password'}
                    </div>

                    {editMode ? (
                      <input
                        className="trade-config-input"
                        value={newPasswordRepeat}
                        onChange={(e) => setNewPasswordRepeat(e.target.value)}
                        type="password"
                      />
                    ) : (
                      <div className="trade-config-value">********</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />

      {showDeleteConfirm && (
        <div className="app-confirm-overlay">
          <div className="app-confirm-card">
            <div className="app-confirm-title">
              {language === 'tr' ? 'Hesabı Sil' : 'Delete Account'}
            </div>

            <div className="app-confirm-text">
              {language === 'tr'
                ? 'Bu işlem geri alınamaz. Devam etmek için şifrenizi girin.'
                : 'This action cannot be undone. Enter your password to continue.'}
            </div>

            <input
              className="trade-config-input"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={language === 'tr' ? 'Şifreniz' : 'Your password'}
            />

            <div className="app-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletePassword('')
                }}
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={handleDeleteAccount}
              >
                {language === 'tr' ? 'Evet, Sil' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}