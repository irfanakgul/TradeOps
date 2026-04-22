import AdminPanelLayout from '../../components/AdminPanelLayout'
import { useLanguage } from '../../components/LanguageContext'

export default function AdminParamsPage() {
  const { language } = useLanguage()

  return (
    <AdminPanelLayout>
      <div className="admin-page-card">
        <div className="admin-page-title">
          {language === 'tr' ? 'Admin Params' : 'Admin Params'}
        </div>

        <div className="admin-page-note">
          {language === 'tr'
            ? 'Bu alan daha sonra admin parametreleri ile doldurulacak.'
            : 'This section will be filled with admin parameters later.'}
        </div>
      </div>
    </AdminPanelLayout>
  )
}