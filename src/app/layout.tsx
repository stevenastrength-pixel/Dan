import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ChatProvider } from '@/lib/chat-context'
import AppShell from '@/components/AppShell'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DAN',
  description: 'Distributed Authoring Nexus — collaborative writing platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Prevent flash of wrong theme — runs before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t!=='light')}catch(e){}` }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <ChatProvider>
            <AppShell>{children}</AppShell>
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
