import PublicPageLayout from '../components/PublicPageLayout'
import { useLanguage } from '../components/LanguageContext'

export default function SubscriptionsPage() {
  const { language } = useLanguage()

  return (
    <PublicPageLayout>
      <section className="public-content-section">
        <div className="trade-config-section-card">
          <div className="trade-config-section-title">
            {language === 'tr' ? 'Abonelikler' : 'Subscriptions'}
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