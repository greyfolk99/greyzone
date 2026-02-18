import { Link, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: '대시보드', icon: '📊' },
  { path: '/requests', label: '요청', icon: '🔐' },
  { path: '/tokens', label: '토큰', icon: '🔑' },
  { path: '/devices', label: '디바이스', icon: '📱' },
  { path: '/settings', label: '설정', icon: '⚙️' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🔐</span>
              <span className="text-xl font-bold">Greyzone</span>
            </Link>
            <div className="text-sm text-gray-400">
              민감한 작업 승인 & 시크릿 관리
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-gray-800 min-h-[calc(100vh-73px)] p-4">
          <ul className="space-y-2">
            {navItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
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

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
