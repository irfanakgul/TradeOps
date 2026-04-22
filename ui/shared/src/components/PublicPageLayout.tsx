import type { ReactNode } from 'react'
import AppHeader from './AppHeader'
import Footer from './Footer'
import PublicSubnav from './PublicSubnav'
import FloatingContactButton from './FloatingContactButton'

export default function PublicPageLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="app-shell">
      <AppHeader />
      <PublicSubnav />
      <main className="public-page-main">{children}</main>
      <FloatingContactButton />
      <Footer />
    </div>
  )
}