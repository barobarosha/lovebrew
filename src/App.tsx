import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Admin from './pages/Admin'
import PwaApp from './pwa/PwaApp'
import Legal from './pages/Legal'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/app" element={<PwaApp />} />
      <Route path="/legal/:slug" element={<Legal />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
