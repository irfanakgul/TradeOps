import { useEffect, useState } from 'react'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import PublicPageLayout from '../components/PublicPageLayout'

type SubjectOption = {
  value: string
  label_tr: string
  label_en: string
}

export default function ContactPage() {
  const { language } = useLanguage()
  const { user } = useAuth()

  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    first_name: '',
    last_name: '',
    mobile_phone: '',
    subject: '',
    message: '',
  })

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      username: user?.username || '',
      email: user?.email || prev.email,
    }))
  }, [user?.username, user?.email])

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/contact-form/subjects')
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result?.detail?.message || 'Failed to load subjects.')
        }

        setSubjects(result.subjects || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subjects.')
      }
    }

    loadSubjects()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch('http://127.0.0.1:8000/api/contact-form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          language,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Submit failed.')
      }

      setBanner(result.message)

      setForm((prev) => ({
        ...prev,
        first_name: '',
        last_name: '',
        mobile_phone: '',
        subject: '',
        message: '',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicPageLayout>
      <section className="public-content-section">
        <div className="trade-config-section-card">
          <div className="trade-config-section-title">
            {language === 'tr'
              ? 'İletişim / Sorun Bildir Formu'
              : 'Contact / Report Issue Form'}
          </div>

          <div className="trade-config-field-note">
            {language === 'tr'
              ? 'Giriş yapmadan da bizimle iletişime geçebilirsiniz. Kullanıcı adı giriş yaptıysanız otomatik gelir.'
              : 'You can contact us even without logging in. Your username is automatically filled if you are signed in.'}
          </div>

          {banner && <div className="success-box">{banner}</div>}
          {error && <div className="error-box-global">{error}</div>}

          <form onSubmit={handleSubmit} className="contact-form-layout compact-contact-form">
            <div className="contact-form-grid compact-two-col">
              <div className="contact-form-field">
                <label className="contact-form-label">
                  {language === 'tr' ? 'Kullanıcı Adı' : 'Username'}
                </label>
                <input
                  className="trade-config-input"
                  value={form.username}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, username: e.target.value }))
                  }
                  disabled={Boolean(user?.username)}
                />
              </div>

              <div className="contact-form-field">
                <label className="contact-form-label">
                  {language === 'tr' ? 'E-posta' : 'Email'}
                </label>
                <input
                  className="trade-config-input"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="contact-form-grid compact-two-col">
              <div className="contact-form-field">
                <label className="contact-form-label">
                  {language === 'tr' ? 'İsim' : 'First Name'}{' '}
                  <span className="optional-note">
                    ({language === 'tr' ? 'opsiyonel' : 'optional'})
                  </span>
                </label>
                <input
                  className="trade-config-input"
                  value={form.first_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                />
              </div>

              <div className="contact-form-field">
                <label className="contact-form-label">
                  {language === 'tr' ? 'Soyisim' : 'Last Name'}{' '}
                  <span className="optional-note">
                    ({language === 'tr' ? 'opsiyonel' : 'optional'})
                  </span>
                </label>
                <input
                  className="trade-config-input"
                  value={form.last_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, last_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="contact-form-grid compact-two-col">
              <div className="contact-form-field">
                <label className="contact-form-label">
                  {language === 'tr' ? 'Telefon Numarası' : 'Mobile Phone'}{' '}
                  <span className="optional-note">
                    ({language === 'tr' ? 'opsiyonel' : 'optional'})
                  </span>
                </label>
                <input
                  className="trade-config-input"
                  value={form.mobile_phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, mobile_phone: e.target.value }))
                  }
                />
              </div>

              <div className="contact-form-field">
                <label className="contact-form-label">
                  {language === 'tr' ? 'Konu' : 'Subject'}
                </label>
                <select
                  className="trade-config-input"
                  value={form.subject}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                >
                  <option value="">
                    {language === 'tr' ? 'Konu seçin' : 'Select a subject'}
                  </option>
                  {subjects.map((item) => (
                    <option key={item.value} value={item.value}>
                      {language === 'tr' ? item.label_tr : item.label_en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="contact-form-field">
              <label className="contact-form-label">
                {language === 'tr' ? 'Mesajınız' : 'Your Message'}
              </label>
              <textarea
                className="contact-form-textarea"
                value={form.message}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, message: e.target.value }))
                }
                rows={7}
              />
            </div>

            <div className="trade-config-toolbar">
              <button
                type="submit"
                className="sidebar-primary-btn"
                disabled={loading}
              >
                {loading
                  ? language === 'tr'
                    ? 'Gönderiliyor...'
                    : 'Sending...'
                  : language === 'tr'
                    ? 'Gönder'
                    : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </PublicPageLayout>
  )
}