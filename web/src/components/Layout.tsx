import { Link, NavLink } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Trang chủ' },
  { to: '/kien-thuc-eeg', label: 'Kiến thức EEG' },
  { to: '/quy-trinh', label: 'Quy trình' },
  { to: '/phan-tich', label: 'Phân tích' },
  { to: '/danh-gia-mo-hinh', label: 'Đánh giá mô hình' },
  { to: '/du-doan', label: 'Dự đoán' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/30 backdrop-blur-glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/30 shadow-glow" />
            <div>
              <div className="text-sm font-semibold tracking-wide">EEG Alcoholism</div>
              <div className="text-xs text-white/60">Web Dashboard</div>
            </div>
          </Link>

          <nav className="hidden gap-2 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <a
            className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/15"
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
          >
            API
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="border-t border-white/10 py-6">
        <div className="mx-auto max-w-6xl px-4 text-xs text-white/50">
          Xây dựng từ pipeline trong notebook • Train=SMNI_CMI_TRAIN • Test=SMNI_CMI_TEST
        </div>
      </footer>
    </div>
  )
}
