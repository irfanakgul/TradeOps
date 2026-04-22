import { Link } from 'react-router-dom'
import { useLanguage } from './LanguageContext'

export default function FloatingContactButton() {
  const { language } = useLanguage()

  return (
    <Link
      to="/contact"
      className="floating-contact-btn"
      title={language === 'tr' ? 'Bizimle iletişime geçin' : 'Contact us'}
      aria-label={language === 'tr' ? 'İletişim formu' : 'Contact form'}
    >
      <span className="floating-contact-icon">✉</span>
      <span className="floating-contact-text">
        {language === 'tr' ? 'İletişim' : 'Contact'}
      </span>
    </Link>
  )
}