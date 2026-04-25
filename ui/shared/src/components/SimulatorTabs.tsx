import { NavLink } from 'react-router-dom'
import { useLanguage } from './LanguageContext'

export default function SimulatorTabs() {
  const { language } = useLanguage()

  const items = [
    {
      to: '/simulator/wallet-overview',
      label: language === 'tr' ? 'Wallet' : 'Wallet',
    },
    {
      to: '/simulator/buys',
      label: language === 'tr' ? 'Buy' : 'Buy',
    },
    {
      to: '/simulator/trade-logs',
      label: language === 'tr' ? 'Open Positions' : 'Open Positions',
    },
    {
      to: '/simulator/parameters',
      label: language === 'tr' ? 'Simulator Parameters' : 'Simulator Parameters',
    },
  ]

  return (
    <div className="sim-tabs">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `sim-tab-link ${isActive ? 'active' : ''}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  )
}