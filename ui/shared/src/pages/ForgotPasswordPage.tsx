import { useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import { useLanguage, type Language } from '../components/LanguageContext'
import logo from '../../../assets/logo/tradeops-logo.png'

export default function ForgotPasswordPage() {
  const { language, setLanguage, t } = useLanguage()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setSuccess(false)

    try {
      setIsSubmitting(true)

      const response = await fetch('http://127.0.0.1:8000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result?.detail?.message || 'Request failed.')
        return
      }

      setSuccess(true)
      setMessage(result.message)
      setEmail('')
    } catch {
      setMessage(
        language === 'tr'
          ? 'Sunucuya bağlanılamadı.'
          : 'Could not connect to server.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-section">
          <img src={logo} alt="TradeOPS Logo" className="logo" />
          <div>
            <h1 className="brand">{t.brand}</h1>
            <p className="status-line">
              {t.status}: <span className="status-ready">{t.statusReady}</span>
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <label className="language-box">
            <span>{t.language}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="tr">TR</option>
              <option value="en">EN</option>
            </select>
          </label>

          <Link to="/" className="secondary-btn link-btn">
            {t.home}
          </Link>
        </div>
      </header>

      <main className="register-layout">
        <section className="register-card">
          <div className="hero-pill">{language === 'tr' ? 'Şifre Sıfırlama' : 'Password Reset'}</div>
          <h2>{language === 'tr' ? 'Şifremi Unuttum' : 'Forgot Password'}</h2>
          <p className="register-subtitle">
            {language === 'tr'
              ? 'Kayıtlı e-posta adresinizi girin. Size şifre sıfırlama bağlantısı gönderelim.'
              : 'Enter your registered email address. We will send you a password reset link.'}
          </p>

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>{t.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="primary-btn submit-btn" disabled={isSubmitting}>
              {isSubmitting
                ? language === 'tr'
                  ? 'Gönderiliyor...'
                  : 'Sending...'
                : language === 'tr'
                  ? 'Sıfırlama Maili Gönder'
                  : 'Send Reset Email'}
            </button>

            {message && (
              <div className={success ? 'success-box' : 'error-box-global'}>
                {message}
              </div>
            )}

            <div className="bottom-nav-row">
              <Link to="/login" className="secondary-btn link-btn">
                {t.login}
              </Link>
              <Link to="/" className="secondary-btn link-btn">
                {t.goHome}
              </Link>
            </div>
          </form>
        </section>
      </main>

      <Footer />
    </div>
  )
}