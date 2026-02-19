import { Link, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: '홈', icon: '📊' },
  { path: '/requests', label: '요청', icon: '🔐' },
  { path: '/tokens', label: '토큰', icon: '🔑' },
  { path: '/devices', label: '기기', icon: '📱' },
  { path: '/settings', label: '설정', icon: '⚙️' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header - 모바일에서 간소화 */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-center sm:justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl">🔐</span>
              <span className="text-lg font-bold">Greyzone</span>
            </Link>
            <div className="hidden sm:block text-sm text-gray-400">
              민감한 작업 승인 & 시크릿 관리
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-20 sm:pb-4 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation - 모바일 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 sm:hidden z-10">
        <ul className="flex justify-around">
          {navItems.map(item => (
            <li key={item.path} className="flex-1">
              <Link
                to={item.path}
                className={`flex flex-col items-center py-2 px-1 text-xs transition ${
                  location.pathname === item.path
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`}
              >
                <span className="text-xl mb-1">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sidebar - 데스크톱 */}
      <nav className="hidden sm:block fixed left-0 top-[57px] bottom-0 w-48 bg-gray-800 border-r border-gray-700 p-3">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  location.pathname === item.path
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content offset for desktop sidebar */}
      <style>{`
        @media (min-width: 640px) {
          main { margin-left: 12rem; }
        }
      `}</style>
    </div>
  )
}
