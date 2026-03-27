import Link from 'next/link'
import DanLogo from '@/components/DanLogo'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-8">
      <DanLogo />
      <div className="text-center space-y-2">
        <p className="text-slate-400 text-sm">
          Select a{' '}
          <Link href="/projects" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            project
          </Link>
          {' '}to get started, or head to{' '}
          <Link href="/agent" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Global Chat
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
