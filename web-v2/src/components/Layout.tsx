import { Link, Outlet, useLocation } from 'react-router-dom'
import { Shield, Key, Smartphone, Settings, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', label: '홈', icon: Home },
  { path: '/requests', label: '요청', icon: Shield },
  { path: '/secrets', label: '시크릿', icon: Key },
  { path: '/devices', label: '기기', icon: Smartphone },
  { path: '/settings', label: '설정', icon: Settings },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-greyzone-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-greyzone-950/80 backdrop-blur-md border-b border-greyzone-800">
        <div className="px-4 py-3 flex items-center justify-center sm:justify-between max-w-4xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-greyzone-800 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-greyzone-400" />
            </div>
            <span className="font-semibold text-lg">Greyzone</span>
          </Link>
          <span className="hidden sm:block text-xs text-greyzone-500">
            승인 & 시크릿 관리
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-20 sm:pb-4 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-greyzone-900/95 backdrop-blur-md border-t border-greyzone-800 sm:hidden z-20">
        <div className="flex justify-around py-2">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center py-1 px-3 rounded-lg transition-colors",
                  isActive 
                    ? "text-white" 
                    : "text-greyzone-500 hover:text-greyzone-300"
                )}
              >
                <Icon className={cn("w-5 h-5 mb-0.5", isActive && "text-white")} />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Sidebar - Desktop */}
      <aside className="hidden sm:flex fixed left-0 top-14 bottom-0 w-16 bg-greyzone-900/50 border-r border-greyzone-800 flex-col items-center py-4 gap-2">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                isActive 
                  ? "bg-greyzone-700 text-white" 
                  : "text-greyzone-500 hover:bg-greyzone-800 hover:text-greyzone-300"
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          )
        })}
      </aside>

      {/* Desktop content offset */}
      <style>{`
        @media (min-width: 640px) {
          main { margin-left: 4rem; }
        }
      `}</style>
    </div>
  )
}
