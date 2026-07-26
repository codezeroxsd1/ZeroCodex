import type { Metadata, Viewport } from 'next'
import { Geist, Space_Grotesk } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
  title: 'Zero Industries | Servicios Eléctricos',
  description:
    'Zero Industries — Servicios eléctricos profesionales para hogares, comercios e industrias en Chile. Diagnóstico, reparaciones, certificación SEC y más.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0d0f0d',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${spaceGrotesk.variable} bg-background`}>
      <body className="min-h-screen overflow-x-hidden bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
