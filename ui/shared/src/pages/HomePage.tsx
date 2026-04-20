import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import AppHeader from '../components/AppHeader'
import { useLanguage, type Language } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import logo from '../../../assets/logo/tradeops-logo.png'

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage()
  const { user } = useAuth()

  return (
    <div className="app-shell">
      {user ? (
        <AppHeader />
      ) : (
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

            <Link to="/login" className="secondary-btn link-btn">
              {t.login}
            </Link>
            <Link to="/register" className="primary-btn link-btn">
              {t.register}
            </Link>
          </div>
        </header>
      )}

      <main className="hero-layout">
        <section className="hero-card">
          <div className="hero-pill">Trade Automation • IBKR • Monitoring</div>
          <h2>{t.homeHeroTitle}</h2>
          <p>{t.homeHeroSubtitle}</p>

          {!user && (
            <div className="hero-actions">
              <Link to="/register" className="primary-btn link-btn">
                {t.register}
              </Link>
              <Link to="/login" className="secondary-btn link-btn">
                {t.login}
              </Link>
            </div>
          )}
        </section>

        <section className="info-grid">
          <article className="info-card">
            <h3>{t.homeAboutTitle}</h3>
            <p>{t.homeAboutText}</p>
          </article>

          <article className="info-card">
            <h3>{t.homeFeaturesTitle}</h3>
            <ul>
              <li>{t.homeFeature1}</li>
              <li>{t.homeFeature2}</li>
              <li>{t.homeFeature3}</li>
              <li>{t.homeFeature4}</li>
            </ul>
          </article>
        </section>
      </main>

      <Footer />
    </div>
  )
}