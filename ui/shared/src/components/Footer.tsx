import { useLanguage } from './LanguageContext'

export default function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="footer">
      <span>{t.footer}</span>
    </footer>
  )
}