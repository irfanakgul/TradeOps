import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import { useLanguage, type Language } from '../components/LanguageContext'
import logo from '../../../assets/logo/tradeops-logo.png'

type FormState = {
  username: string
  email: string
  emailRepeat: string
  firstName: string
  lastName: string
  dateOfBirth: string
  country: string
  mobilePhone: string
  gender: string
  experience: string
  estimatedBudget: string
  password: string
  passwordRepeat: string
  responsibilityApproved: boolean
}

type FormErrors = Partial<Record<keyof FormState, string>>

const initialState: FormState = {
  username: '',
  email: '',
  emailRepeat: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  country: '',
  mobilePhone: '',
  gender: '',
  experience: '',
  estimatedBudget: '',
  password: '',
  passwordRepeat: '',
  responsibilityApproved: false,
}

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email)
}

function isValidPassword(password: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)
}

function isAdult(dateOfBirth: string) {
  if (!dateOfBirth) return false

  const dob = new Date(dateOfBirth)
  const today = new Date()

  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }

  return age >= 18
}

export default function RegisterPage() {
  const { language, setLanguage, t } = useLanguage()
  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementScrolledToEnd, setAgreementScrolledToEnd] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const agreementRef = useRef<HTMLDivElement | null>(null)

  const agreementText = useMemo(
    () =>
      language === 'tr'
        ? `
Bu uygulama yatırım tavsiyesi vermez. Kullanıcı, platform üzerinden yapılan tüm işlemlerin kendi sorumluluğunda olduğunu kabul eder.

TradeOPS yalnızca execution ve monitoring amacıyla geliştirilmiş bir uygulamadır. Piyasa riskleri, sermaye kaybı, bağlantı hataları, kullanıcı hataları, broker kaynaklı aksaklıklar ve üçüncü taraf sistem riskleri tamamen kullanıcı tarafından bilinmeli ve kabul edilmelidir.

Kullanıcı, platformu kullanmadan önce yeterli finansal bilgiye sahip olduğunu, kendi riskini yönettiğini ve reşit olduğunu beyan eder.

TradeOPS geliştiricileri, piyasa hareketlerinden, kullanıcı hatalarından, teknik gecikmelerden, veri aktarım problemlerinden veya üçüncü taraf servis kesintilerinden doğabilecek zararlardan sorumlu tutulamaz.

Bu sözleşme, kullanıcı kayıt işleminin ayrılmaz bir parçasıdır.
`
        : `
This application does not provide investment advice. The user accepts that all actions taken through the platform are under their own responsibility.

TradeOPS is developed for execution and monitoring purposes only. Market risks, capital loss, connection failures, user errors, broker-side issues, and third-party system risks must be fully understood and accepted by the user.

The user declares that they are of legal age, have sufficient financial understanding, and manage their own risk before using the platform.

The developers of TradeOPS cannot be held responsible for losses resulting from market movements, user mistakes, technical delays, data transfer issues, or third-party service interruptions.

This agreement is an inseparable part of the user registration process.
`,
    [language],
  )

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function validateForm() {
    const newErrors: FormErrors = {}

    if (!form.username.trim()) newErrors.username = t.validationRequired
    else if (form.username.trim().length < 3) {
      newErrors.username = t.validationUsernameMin
    }

    if (!form.email.trim()) newErrors.email = t.validationRequired
    else if (!isValidEmail(form.email)) {
      newErrors.email = t.validationEmailInvalid
    }

    if (!form.emailRepeat.trim()) newErrors.emailRepeat = t.validationRequired
    else if (form.email !== form.emailRepeat) {
      newErrors.emailRepeat = t.validationEmailMatch
    }

    if (!form.firstName.trim()) newErrors.firstName = t.validationRequired
    if (!form.lastName.trim()) newErrors.lastName = t.validationRequired

    if (!form.dateOfBirth.trim()) newErrors.dateOfBirth = t.validationRequired
    else if (!isAdult(form.dateOfBirth)) {
      newErrors.dateOfBirth = t.validationAge
    }

    if (!form.country.trim()) newErrors.country = t.validationRequired
    if (!form.mobilePhone.trim()) newErrors.mobilePhone = t.validationRequired
    if (!form.gender.trim()) newErrors.gender = t.validationRequired
    if (!form.experience.trim()) newErrors.experience = t.validationRequired

    if (!form.estimatedBudget.trim()) {
      newErrors.estimatedBudget = t.validationRequired
    } else if (Number(form.estimatedBudget) <= 0) {
      newErrors.estimatedBudget = t.validationBudget
    }

    if (!form.password.trim()) newErrors.password = t.validationRequired
    else if (!isValidPassword(form.password)) {
      newErrors.password = t.validationPasswordRule
    }

    if (!form.passwordRepeat.trim()) {
      newErrors.passwordRepeat = t.validationRequired
    } else if (form.password !== form.passwordRepeat) {
      newErrors.passwordRepeat = t.validationPasswordMatch
    }

    if (!form.responsibilityApproved) {
      newErrors.responsibilityApproved = t.validationAgreement
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitMessage('')
    setSubmitSuccess(false)
    setErrors({})

    if (!validateForm()) return

    try {
      setIsSubmitting(true)

      const response = await fetch('http://127.0.0.1:8000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          language,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        const field = result?.detail?.field
        const message = result?.detail?.message || 'Registration failed.'

        if (field) {
          setErrors((prev) => ({
            ...prev,
            [field]: message,
          }))
        } else {
          setSubmitMessage(message)
        }

        return
      }

      setSubmitSuccess(true)
      setSubmitMessage(
        result.message || 'Registration completed successfully.',
      )
      setForm(initialState)
      setAgreementScrolledToEnd(false)
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
          <Link to="/login" className="secondary-btn link-btn">
            {t.login}
          </Link>
        </div>
      </header>

      <main className="register-layout">
        <section className="register-card">
          <div className="hero-pill">{t.register}</div>
          <h2>{t.registerTitle}</h2>
          <p className="register-subtitle">{t.registerSubtitle}</p>

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>{t.username}</label>
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                />
                {errors.username && (
                  <span className="error-text">{errors.username}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.email}</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                />
                {errors.email && (
                  <span className="error-text">{errors.email}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.emailRepeat}</label>
                <input
                  name="emailRepeat"
                  type="email"
                  value={form.emailRepeat}
                  onChange={handleChange}
                />
                {errors.emailRepeat && (
                  <span className="error-text">{errors.emailRepeat}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.firstName}</label>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                />
                {errors.firstName && (
                  <span className="error-text">{errors.firstName}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.lastName}</label>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                />
                {errors.lastName && (
                  <span className="error-text">{errors.lastName}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.dateOfBirth}</label>
                <input
                  name="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                />
                {errors.dateOfBirth && (
                  <span className="error-text">{errors.dateOfBirth}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.country}</label>
                <input
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                />
                {errors.country && (
                  <span className="error-text">{errors.country}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.mobilePhone}</label>
                <input
                  name="mobilePhone"
                  value={form.mobilePhone}
                  onChange={handleChange}
                />
                {errors.mobilePhone && (
                  <span className="error-text">{errors.mobilePhone}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.gender}</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                >
                  <option value="">--</option>
                  <option value="MALE">{t.genderMale}</option>
                  <option value="FEMALE">{t.genderFemale}</option>
                  <option value="OTHER">{t.genderOther}</option>
                  <option value="PREFER_NOT_TO_SAY">{t.genderNoSay}</option>
                </select>
                {errors.gender && (
                  <span className="error-text">{errors.gender}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.experience}</label>
                <select
                  name="experience"
                  value={form.experience}
                  onChange={handleChange}
                >
                  <option value="">--</option>
                  <option value="BEGINNER">{t.expBeginner}</option>
                  <option value="INTERMEDIATE">{t.expIntermediate}</option>
                  <option value="GOOD">{t.expGood}</option>
                  <option value="VERY_GOOD">{t.expVeryGood}</option>
                </select>
                {errors.experience && (
                  <span className="error-text">{errors.experience}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.estimatedBudget}</label>
                <input
                  name="estimatedBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedBudget}
                  onChange={handleChange}
                />
                {errors.estimatedBudget && (
                  <span className="error-text">{errors.estimatedBudget}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.password}</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                />
                {errors.password && (
                  <span className="error-text">{errors.password}</span>
                )}
              </div>

              <div className="form-field">
                <label>{t.passwordRepeat}</label>
                <input
                  name="passwordRepeat"
                  type="password"
                  value={form.passwordRepeat}
                  onChange={handleChange}
                />
                {errors.passwordRepeat && (
                  <span className="error-text">{errors.passwordRepeat}</span>
                )}
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
                    name="responsibilityApproved"
                    checked={form.responsibilityApproved}
                    onChange={handleChange}
                    disabled={!agreementScrolledToEnd}
                  />
                  <span>{t.responsibilityApproval}</span>
                </label>
              </div>

              {errors.responsibilityApproved && (
                <span className="error-text">
                  {errors.responsibilityApproved}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="primary-btn submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? language === 'tr'
                  ? 'Kaydediliyor...'
                  : 'Submitting...'
                : t.registerNow}
            </button>

            {submitMessage && (
              <div className={submitSuccess ? 'success-box' : 'error-box-global'}>
                {submitMessage}
              </div>
            )}
          </form>

          <div className="bottom-nav-row">
            <button className="secondary-btn">{t.goLogin}</button>
            <Link to="/" className="secondary-btn link-btn">
              {t.goHome}
            </Link>
          </div>
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
                  setForm((prev) => ({
                    ...prev,
                    responsibilityApproved: true,
                  }))
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