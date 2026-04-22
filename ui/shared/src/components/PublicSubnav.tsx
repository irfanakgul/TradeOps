import { NavLink } from 'react-router-dom'
import { useLanguage } from './LanguageContext'

export default function PublicSubnav() {
  const { language } = useLanguage()

  const items = [
    { to: '/', tr: 'Ana Sayfa', en: 'Home', end: true },
    { to: '/subscriptions', tr: 'Abonelikler', en: 'Subscriptions' },
    { to: '/simulations', tr: 'Simülasyonlar', en: 'Simulations' },
    { to: '/contact', tr: 'İletişim', en: 'Contact' },
    { to: '/about', tr: 'Hakkımızda', en: 'About' },
  ]

  return (
    <div className="public-subnav-wrap">
      <div className="public-subnav">
        <div className="public-subnav-inner">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `public-subnav-link ${isActive ? 'active' : ''}`
              }
            >
              {language === 'tr' ? item.tr : item.en}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}