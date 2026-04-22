import PublicPageLayout from '../components/PublicPageLayout'
import { useLanguage } from '../components/LanguageContext'

export default function SimulationsPage() {
  const { language } = useLanguage()

  return (
    <PublicPageLayout>
      <section className="public-content-section">
        <div className="trade-config-section-card">
          <div className="trade-config-section-title">
            {language === 'tr' ? 'Simülasyonlar' : 'Simulations'}
          </div>
          <div className="trade-config-field-note">
            {language === 'tr'
              ? 'Bu alan daha sonra doldurulacak.'
              : 'This section will be filled later.'}
          </div>
        </div>
      </section>
    </PublicPageLayout>
  )
}