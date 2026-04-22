import AdminPanelLayout from '../../components/AdminPanelLayout'
import { useLanguage } from '../../components/LanguageContext'

export default function NotificationSenderPage() {
  const { language } = useLanguage()

  return (
    <AdminPanelLayout>
      <div className="admin-page-card">
        <div className="admin-page-title">
          {language === 'tr' ? 'Notification Sender' : 'Notification Sender'}
        </div>

        <div className="admin-page-note">
          {language === 'tr'
            ? 'Bu alan daha sonra bildirim gönderme araçları ile doldurulacak.'
            : 'This section will be filled with notification tools later.'}
        </div>
      </div>
    </AdminPanelLayout>
  )
}