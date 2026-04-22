import { Link } from 'react-router-dom'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import PublicPageLayout from '../components/PublicPageLayout'

export default function HomePage() {
  const { t } = useLanguage()
  const { user } = useAuth()

  return (
    <PublicPageLayout>
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
    </PublicPageLayout>
  )
}