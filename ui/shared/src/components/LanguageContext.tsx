import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Language = 'tr' | 'en'

const STORAGE_KEY = 'tradeops-language'

type TranslationMap = {
  brand: string
  status: string
  statusReady: string
  language: string
  login: string
  register: string
  home: string
  goHome: string
  email: string
  password: string
  readAgreement: string
  responsibilityApproval: string
  agreementTitle: string
  agreementScrollWarning: string
  agreementClose: string
  agreementConfirm: string
  validationRequired: string
  validationUsernameMin: string
  validationEmailInvalid: string
  validationEmailMatch: string
  validationAge: string
  validationBudget: string
  validationPasswordRule: string
  validationPasswordMatch: string
  validationAgreement: string
  homeHeroTitle: string
  homeHeroSubtitle: string
  homeAboutTitle: string
  homeAboutText: string
  homeFeaturesTitle: string
  homeFeature1: string
  homeFeature2: string
  homeFeature3: string
  homeFeature4: string
}

const translations: Record<Language, TranslationMap> = {
  en: {
    brand: 'TradeOPS',
    status: 'Status',
    statusReady: 'Ready',
    language: 'Language',
    login: 'Login',
    register: 'Register',
    home: 'Home',
    goHome: 'Go Home',
    email: 'Email',
    password: 'Password',
    readAgreement: 'Read Agreement',
    responsibilityApproval: 'I approve the responsibility agreement',
    agreementTitle: 'Responsibility Agreement',
    agreementScrollWarning: 'Please scroll to the end before confirming.',
    agreementClose: 'Close',
    agreementConfirm: 'Confirm',
    validationRequired: 'This field is required.',
    validationUsernameMin: 'Username must be at least 3 characters.',
    validationEmailInvalid: 'Please enter a valid email address.',
    validationEmailMatch: 'Email addresses do not match.',
    validationAge: 'You must be at least 18 years old.',
    validationBudget: 'Estimated budget must be greater than 0.',
    validationPasswordRule:
      'Password must contain at least 6 characters, one uppercase letter, one lowercase letter, and one number.',
    validationPasswordMatch: 'Passwords do not match.',
    validationAgreement: 'You must approve the agreement to continue.',
    homeHeroTitle: 'Professional Trade Automation and Monitoring',
    homeHeroSubtitle:
      'TradeOPS is built for disciplined execution, IBKR-based workflows, and centralized monitoring.',
    homeAboutTitle: 'About TradeOPS',
    homeAboutText:
      'TradeOPS is designed for controlled trading operations, workflow discipline, and operational visibility.',
    homeFeaturesTitle: 'Core Features',
    homeFeature1: 'IBKR-integrated execution workflow',
    homeFeature2: 'Server runtime control and logging',
    homeFeature3: 'Portfolio, order, and wallet monitoring',
    homeFeature4: 'Configurable trade parameters and user management',
  },
  tr: {
    brand: 'TradeOPS',
    status: 'Durum',
    statusReady: 'Hazır',
    language: 'Dil',
    login: 'Giriş Yap',
    register: 'Kayıt Ol',
    home: 'Ana Sayfa',
    goHome: 'Ana Sayfaya Dön',
    email: 'E-posta',
    password: 'Şifre',
    readAgreement: 'Sözleşmeyi Oku',
    responsibilityApproval: 'Sorumluluk sözleşmesini onaylıyorum',
    agreementTitle: 'Sorumluluk Sözleşmesi',
    agreementScrollWarning: 'Lütfen onaylamadan önce sonuna kadar kaydırın.',
    agreementClose: 'Kapat',
    agreementConfirm: 'Onayla',
    validationRequired: 'Bu alan zorunludur.',
    validationUsernameMin: 'Kullanıcı adı en az 3 karakter olmalıdır.',
    validationEmailInvalid: 'Geçerli bir e-posta adresi girin.',
    validationEmailMatch: 'E-posta adresleri eşleşmiyor.',
    validationAge: 'En az 18 yaşında olmalısınız.',
    validationBudget: 'Tahmini bütçe 0’dan büyük olmalıdır.',
    validationPasswordRule:
      'Şifre en az 6 karakter olmalı, bir büyük harf, bir küçük harf ve bir sayı içermelidir.',
    validationPasswordMatch: 'Şifreler eşleşmiyor.',
    validationAgreement: 'Devam etmek için sözleşmeyi onaylamalısınız.',
    homeHeroTitle: 'Profesyonel Trade Otomasyonu ve Monitoring',
    homeHeroSubtitle:
      'TradeOPS, disiplinli execution, IBKR tabanlı akışlar ve merkezi monitoring için geliştirilmiştir.',
    homeAboutTitle: 'TradeOPS Hakkında',
    homeAboutText:
      'TradeOPS, kontrollü trade operasyonları, süreç disiplini ve operasyonel görünürlük için tasarlanmıştır.',
    homeFeaturesTitle: 'Temel Özellikler',
    homeFeature1: 'IBKR entegre execution akışı',
    homeFeature2: 'Server runtime kontrolü ve log ekranı',
    homeFeature3: 'Portföy, emir ve cüzdan izleme',
    homeFeature4: 'Trade parametreleri ve kullanıcı yönetimi',
  },
}

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: TranslationMap
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'tr' || saved === 'en') {
        setLanguageState(saved)
      } else {
        setLanguageState('en')
      }
    } catch {
      setLanguageState('en')
    }
  }, [])

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage)
    try {
      localStorage.setItem(STORAGE_KEY, nextLanguage)
    } catch {
      //
    }
  }

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