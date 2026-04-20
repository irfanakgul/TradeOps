import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Language = 'tr' | 'en'

type Translation = {
  brand: string
  status: string
  statusReady: string
  language: string
  login: string
  register: string
  home: string
  footer: string

  homeHeroTitle: string
  homeHeroSubtitle: string
  homeAboutTitle: string
  homeAboutText: string
  homeFeaturesTitle: string
  homeFeature1: string
  homeFeature2: string
  homeFeature3: string
  homeFeature4: string

  registerTitle: string
  registerSubtitle: string
  username: string
  email: string
  emailRepeat: string
  firstName: string
  lastName: string
  dateOfBirth: string
  country: string
  mobilePhone: string
  gender: string
  experience: string
  estimatedBudget: string
  password: string
  passwordRepeat: string
  responsibilityApproval: string
  readAgreement: string
  agreementTitle: string
  agreementConfirm: string
  agreementClose: string
  agreementScrollWarning: string

  genderMale: string
  genderFemale: string
  genderOther: string
  genderNoSay: string

  expBeginner: string
  expIntermediate: string
  expGood: string
  expVeryGood: string

  registerNow: string
  goLogin: string
  goHome: string

  validationRequired: string
  validationUsernameMin: string
  validationEmailMatch: string
  validationPasswordRule: string
  validationPasswordMatch: string
  validationAge: string
  validationAgreement: string
  validationBudget: string
  validationEmailInvalid: string
}

const translations: Record<Language, Translation> = {
  tr: {
    brand: 'TradeOPS',
    status: 'Durum',
    statusReady: 'UI Hazır',
    language: 'Dil',
    login: 'Giriş Yap',
    register: 'Kayıt Ol',
    home: 'Ana Sayfa',
    footer: 'TradeOps - powered by IrfanA @2026 - All Rights Reserved',

    homeHeroTitle: 'TradeOPS Execution Control Panel',
    homeHeroSubtitle:
      'Algoritmik trade execution sisteminizi başlatın, izleyin ve tüm süreçleri tek panelden yönetin.',
    homeAboutTitle: 'Uygulama Amacı',
    homeAboutText:
      'TradeOPS, merkezi veritabanından gelen sinyalleri okuyup yerelde çalışan execution motorunu kontrol etmek için tasarlanmış modern bir masaüstü uygulamasıdır.',
    homeFeaturesTitle: 'İlk Sürümde Neler Olacak?',
    homeFeature1: 'Server başlat / durdur',
    homeFeature2: 'Broker bağlantı durumu',
    homeFeature3: 'Canlı log ekranı',
    homeFeature4: 'Cüzdan, pozisyon ve trade görüntüleme',

    registerTitle: 'Yeni Kullanıcı Kaydı',
    registerSubtitle:
      'TradeOPS platformuna kayıt olmak için aşağıdaki bilgileri eksiksiz doldurun.',
    username: 'Kullanıcı Adı',
    email: 'E-posta Adresi',
    emailRepeat: 'E-posta Tekrar',
    firstName: 'Ad',
    lastName: 'Soyad',
    dateOfBirth: 'Doğum Tarihi',
    country: 'Yaşadığı Ülke',
    mobilePhone: 'Cep Telefonu',
    gender: 'Cinsiyet',
    experience: 'Borsa Tecrübesi',
    estimatedBudget: 'Tahmini Başlangıç Bütçesi',
    password: 'Şifre',
    passwordRepeat: 'Şifre Tekrar',
    responsibilityApproval: 'Sorumluluk sözleşmesini okudum ve onaylıyorum',
    readAgreement: 'Sözleşmeyi Oku',
    agreementTitle: 'Sorumluluk Sözleşmesi',
    agreementConfirm: 'Okudum ve Onaylıyorum',
    agreementClose: 'Kapat',
    agreementScrollWarning: 'Onay için metnin sonuna kadar kaydırman gerekir.',

    genderMale: 'Erkek',
    genderFemale: 'Kadın',
    genderOther: 'Diğer',
    genderNoSay: 'Belirtmek İstemiyorum',

    expBeginner: 'Başlangıç',
    expIntermediate: 'Orta',
    expGood: 'İyi',
    expVeryGood: 'Çok İyi',

    registerNow: 'Kaydı Oluştur',
    goLogin: 'LOG IN',
    goHome: 'HOME',

    validationRequired: 'Bu alan zorunludur.',
    validationUsernameMin: 'Kullanıcı adı en az 3 karakter olmalıdır.',
    validationEmailMatch: 'E-posta alanları aynı olmalıdır.',
    validationPasswordRule:
      'Şifre en az 6 karakter olmalı; büyük harf, küçük harf ve sayı içermelidir.',
    validationPasswordMatch: 'Şifre alanları aynı olmalıdır.',
    validationAge: '18 yaşından küçük kullanıcılar kayıt olamaz.',
    validationAgreement: 'Sorumluluk sözleşmesi onaylanmalıdır.',
    validationBudget: 'Bütçe 0’dan büyük olmalıdır.',
    validationEmailInvalid: 'Geçerli bir e-posta adresi girin.',
  },
  en: {
    brand: 'TradeOPS',
    status: 'Status',
    statusReady: 'UI Ready',
    language: 'Language',
    login: 'Login',
    register: 'Register',
    home: 'Home',
    footer: 'TradeOps - powered by IrfanA @2026 - All Rights Reserved',

    homeHeroTitle: 'TradeOPS Execution Control Panel',
    homeHeroSubtitle:
      'Start, monitor, and manage your algorithmic trade execution system from a single panel.',
    homeAboutTitle: 'Application Purpose',
    homeAboutText:
      'TradeOPS is a modern desktop application designed to control the locally running execution engine using signals coming from a central database.',
    homeFeaturesTitle: 'What Will Be in the First Version?',
    homeFeature1: 'Start / stop server',
    homeFeature2: 'Broker connection status',
    homeFeature3: 'Live log screen',
    homeFeature4: 'Wallet, position, and trade views',

    registerTitle: 'New User Registration',
    registerSubtitle:
      'Complete the form below to create your TradeOPS account.',
    username: 'Username',
    email: 'Email Address',
    emailRepeat: 'Repeat Email',
    firstName: 'First Name',
    lastName: 'Last Name',
    dateOfBirth: 'Date of Birth',
    country: 'Country',
    mobilePhone: 'Mobile Phone',
    gender: 'Gender',
    experience: 'Exchange Experience',
    estimatedBudget: 'Estimated Starting Budget',
    password: 'Password',
    passwordRepeat: 'Repeat Password',
    responsibilityApproval: 'I have read and approve the responsibility agreement',
    readAgreement: 'Read Agreement',
    agreementTitle: 'Responsibility Agreement',
    agreementConfirm: 'I Have Read and Approve',
    agreementClose: 'Close',
    agreementScrollWarning: 'You must scroll to the bottom before approval.',

    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Other',
    genderNoSay: 'Prefer Not To Say',

    expBeginner: 'Beginner',
    expIntermediate: 'Intermediate',
    expGood: 'Good',
    expVeryGood: 'Very Good',

    registerNow: 'Create Registration',
    goLogin: 'LOG IN',
    goHome: 'HOME',

    validationRequired: 'This field is required.',
    validationUsernameMin: 'Username must be at least 3 characters.',
    validationEmailMatch: 'Email fields must match.',
    validationPasswordRule:
      'Password must be at least 6 characters and include uppercase, lowercase, and a number.',
    validationPasswordMatch: 'Password fields must match.',
    validationAge: 'Users under 18 are not allowed to register.',
    validationAgreement: 'The responsibility agreement must be approved.',
    validationBudget: 'Budget must be greater than 0.',
    validationEmailInvalid: 'Enter a valid email address.',
  },
}

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translation
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('tr')

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: translations[language],
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}