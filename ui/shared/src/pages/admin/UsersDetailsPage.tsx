import AdminPanelLayout from '../../components/AdminPanelLayout'
import { useLanguage } from '../../components/LanguageContext'

export default function UsersDetailsPage() {
  const { language } = useLanguage()

  return (
    <AdminPanelLayout>
      <div className="admin-page-card">
        <div className="admin-page-title">
          {language === 'tr' ? 'Users Details' : 'Users Details'}
        </div>

        <div className="admin-page-note">
          {language === 'tr'
            ? 'Bu alan daha sonra kullanıcı detayları ile doldurulacak.'
            : 'This section will be filled with user details later.'}
        </div>
      </div>
    </AdminPanelLayout>
  )
}