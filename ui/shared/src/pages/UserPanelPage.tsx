import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import { useLanguage } from '../components/LanguageContext'

export default function UserPanelPage() {
  const { language } = useLanguage()

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="page-content-with-header">
        <section className="register-card">
          <div className="hero-pill">
            {language === 'tr' ? 'Kullanıcı Paneli' : 'User Panel'}
          </div>
          <h2>{language === 'tr' ? 'Kullanıcı Paneli' : 'User Panel'}</h2>
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