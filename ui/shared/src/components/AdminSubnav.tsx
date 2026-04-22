import { NavLink } from 'react-router-dom'
import { useLanguage } from './LanguageContext'

export default function AdminSubnav() {
  const { language } = useLanguage()

  const items = [
    {
      to: '/admin-panel/users-details',
      tr: 'Users Details',
      en: 'Users Details',
    },
    {
      to: '/admin-panel/contact-forms',
      tr: 'Contact Forms',
      en: 'Contact Forms',
    },
    {
      to: '/admin-panel/admin-params',
      tr: 'Admin Params',
      en: 'Admin Params',
    },
    {
      to: '/admin-panel/notification-sender',
      tr: 'Notification Sender',
      en: 'Notification Sender',
    },
    {
      to: '/admin-panel/stats',
      tr: 'Stats',
      en: 'Stats',
    },
  ]

  return (
    <div className="admin-subnav-wrap">
      <div className="admin-subnav">
        <div className="admin-subnav-inner">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `admin-subnav-link ${isActive ? 'active' : ''}`
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