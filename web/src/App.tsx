import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Layout from './components/Layout'
import Home from './pages/Home'
import KienThucEEG from './pages/KienThucEEG'
import QuyTrinh from './pages/QuyTrinh'
import PhanTich from './pages/PhanTich'
import DuDoan from './pages/DuDoan'
import DanhGiaMoHinh from './pages/DanhGiaMoHinh'

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><Home /></Page>} />
          <Route path="/kien-thuc-eeg" element={<Page><KienThucEEG /></Page>} />
          <Route path="/quy-trinh" element={<Page><QuyTrinh /></Page>} />
          <Route path="/phan-tich" element={<Page><PhanTich /></Page>} />
          <Route path="/danh-gia-mo-hinh" element={<Page><DanhGiaMoHinh /></Page>} />
          <Route path="/du-doan" element={<Page><DuDoan /></Page>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  )
}
