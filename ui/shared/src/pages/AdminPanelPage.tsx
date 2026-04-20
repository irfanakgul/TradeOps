import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import { useLanguage } from '../components/LanguageContext'

export default function AdminPanelPage() {
  const { language } = useLanguage()

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="page-content-with-header">
        <section className="register-card">
          <div className="hero-pill">
            {language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}
          </div>
          <h2>{language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}</h2>
          <p className="register-subtitle">
            {language === 'tr'
              ? 'Bu alanı sonra dolduracağız.'
              : 'We will fill this area later.'}
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}