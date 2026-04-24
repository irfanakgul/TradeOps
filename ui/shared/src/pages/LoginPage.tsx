import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import { useLanguage, type Language } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import logo from '../../../assets/logo/tradeops-logo.png'

type LoginErrors = {
  email?: string
  password?: string
  responsibilityApproved?: string
}

export default function LoginPage() {
  const { language, setLanguage, t } = useLanguage()
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [responsibilityApproved, setResponsibilityApproved] = useState(false)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementScrolledToEnd, setAgreementScrolledToEnd] = useState(false)
  const agreementRef = useRef<HTMLDivElement | null>(null)

  const agreementText = useMemo(
    () =>
      language === 'tr'
        ? `
Bu uygulama yatırım tavsiyesi vermez. Kullanıcı, platform üzerinden yapılan tüm işlemlerin kendi sorumluluğunda olduğunu kabul eder.

TradeOPS yalnızca execution ve monitoring amacıyla geliştirilmiş bir uygulamadır. Piyasa riskleri, sermaye kaybı, bağlantı hataları, kullanıcı hataları, broker kaynaklı aksaklıklar ve üçüncü taraf sistem riskleri tamamen kullanıcı tarafından bilinmeli ve kabul edilmelidir.

Kullanıcı, platformu kullanmadan önce yeterli finansal bilgiye sahip olduğunu, kendi riskini yönettiğini ve reşit olduğunu beyan eder.

TradeOPS geliştiricileri, piyasa hareketlerinden, kullanıcı hatalarından, teknik gecikmelerden, veri aktarım problemlerinden veya üçüncü taraf servis kesintilerinden doğabilecek zararlardan sorumlu tutulamaz.
`
        : `
This application does not provide investment advice. The user accepts that all actions taken through the platform are under their own responsibility.

TradeOPS is developed for execution and monitoring purposes only. Market risks, capital loss, connection failures, user errors, broker-side issues, and third-party system risks must be fully understood and accepted by the user.

The user declares that they are of legal age, have sufficient financial understanding, and manage their own risk before using the platform.

The developers of TradeOPS cannot be held responsible for losses resulting from market movements, user mistakes, technical delays, data transfer issues, or third-party service interruptions.
`,
    [language],
  )

  function validateForm() {
    const newErrors: LoginErrors = {}

    if (!email.trim()) newErrors.email = t.validationRequired
    if (!password.trim()) newErrors.password = t.validationRequired

    if (!responsibilityApproved) {
      newErrors.responsibilityApproved =
        language === 'tr'
          ? 'Giriş için sorumluluk sözleşmesini onaylamanız gerekir.'
          : 'You must approve the responsibility agreement to continue.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSubmitMessage('')
    setSubmitSuccess(false)

    if (!validateForm()) return

    try {
      setIsSubmitting(true)

      const response = await fetch('http://127.0.0.1:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          responsibilityApproved,
          language,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        const field = result?.detail?.field
        const message = result?.detail?.message || (
          language === 'tr' ? 'Giriş başarısız.' : 'Login failed.'
        )
        const warning = result?.detail?.warning
      
        if (field) {
          setErrors((prev) => ({
            ...prev,
            [field]: warning ? `${message} ${warning}` : message,
          }))
        } else {
          setSubmitMessage(warning ? `${message} ${warning}` : message)
        }
      
        return
      }

      setSubmitSuccess(true)
      setSubmitMessage(
        result?.message ||
          (language === 'tr' ? 'Giriş başarılı.' : 'Login successful.'),
      )

      setUser({
        username: result.user.username,
        email: result.user.email,
        userType: result.user.user_type,
        deviceId: result.user.device_id,
      })

      setTimeout(() => {
        navigate('/broker')
      }, 800)
    } catch {
      setSubmitMessage(
        language === 'tr'
          ? 'Sunucuya bağlanılamadı. Backend API çalışıyor mu kontrol edin.'
          : 'Could not connect to server. Check whether backend API is running.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleAgreementScroll(e: React.UIEvent<HTMLDivElement>) {
    const element = e.currentTarget
    const atBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 8

    if (atBottom) {
      setAgreementScrolledToEnd(true)
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
          <div className="hero-pill">{t.login}</div>
          <h2>{language === 'tr' ? 'Kullanıcı Girişi' : 'User Login'}</h2>
          <p className="register-subtitle">
            {language === 'tr'
              ? 'TradeOPS hesabınıza giriş yapmak için bilgilerinizi girin.'
              : 'Enter your credentials to access your TradeOPS account.'}
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
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-field">
                <label>{t.password}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>
            </div>

            <div className="agreement-box">
              <div className="agreement-top">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowAgreement(true)
                    setAgreementScrolledToEnd(false)
                  }}
                >
                  {t.readAgreement}
                </button>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={responsibilityApproved}
                    onChange={(e) => setResponsibilityApproved(e.target.checked)}
                    disabled={!agreementScrolledToEnd}
                  />
                  <span>{t.responsibilityApproval}</span>
                </label>
              </div>

              {errors.responsibilityApproved && (
                <span className="error-text">{errors.responsibilityApproved}</span>
              )}
            </div>

            <button
              type="submit"
              className="primary-btn submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? language === 'tr'
                  ? 'Giriş yapılıyor...'
                  : 'Signing in...'
                : t.login}
            </button>

            {submitMessage && (
              <div className={submitSuccess ? 'success-box' : 'error-box-global'}>
                {submitMessage}
              </div>
            )}

            <div className="bottom-nav-row">
              <Link to="/forgot-password" className="secondary-btn link-btn">
                {language === 'tr' ? 'Şifremi Unuttum' : 'Forgot Password'}
              </Link>
              <Link to="/" className="secondary-btn link-btn">
                {t.goHome}
              </Link>
            </div>
          </form>
        </section>
      </main>

      <Footer />

      {showAgreement && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>{t.agreementTitle}</h3>

            <div
              ref={agreementRef}
              className="agreement-scroll"
              onScroll={handleAgreementScroll}
            >
              {agreementText}
            </div>

            {!agreementScrolledToEnd && (
              <p className="agreement-warning">{t.agreementScrollWarning}</p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowAgreement(false)}
              >
                {t.agreementClose}
              </button>

              <button
                type="button"
                className="primary-btn"
                disabled={!agreementScrolledToEnd}
                onClick={() => {
                  setResponsibilityApproved(true)
                  setShowAgreement(false)
                }}
              >
                {t.agreementConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}