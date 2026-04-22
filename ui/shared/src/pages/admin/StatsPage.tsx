import AdminPanelLayout from '../../components/AdminPanelLayout'
import { useLanguage } from '../../components/LanguageContext'

export default function StatsPage() {
  const { language } = useLanguage()

  return (
    <AdminPanelLayout>
      <div className="admin-page-card">
        <div className="admin-page-title">
          {language === 'tr' ? 'Stats' : 'Stats'}
        </div>

        <div className="admin-page-note">
          {language === 'tr'
            ? 'Bu alan daha sonra istatistik ekranları ile doldurulacak.'
            : 'This section will be filled with statistics later.'}
        </div>
      </div>
    </AdminPanelLayout>
  )
}