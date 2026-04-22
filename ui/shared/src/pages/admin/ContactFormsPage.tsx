import AdminPanelLayout from '../../components/AdminPanelLayout'
import { useLanguage } from '../../components/LanguageContext'

export default function ContactFormsPage() {
  const { language } = useLanguage()

  return (
    <AdminPanelLayout>
      <div className="admin-page-card">
        <div className="admin-page-title">
          {language === 'tr' ? 'Contact Forms' : 'Contact Forms'}
        </div>

        <div className="admin-page-note">
          {language === 'tr'
            ? 'Bu alan daha sonra contact form kayıtları ile doldurulacak.'
            : 'This section will be filled with contact form records later.'}
        </div>
      </div>
    </AdminPanelLayout>
  )
}