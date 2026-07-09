import { Routes, Route, Navigate } from 'react-router-dom'
import { CatalogProvider } from './context/CatalogContext.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import AppShell from './components/AppShell.jsx'
import CatalogHealth from './pages/CatalogHealth.jsx'
import SearchComparison from './pages/SearchComparison.jsx'
import CrossSell from './pages/CrossSell.jsx'

function RequireAuth({ children }) {
  const authed = localStorage.getItem('sf_authenticated') === 'true'
  return authed ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <CatalogProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/app/catalog" replace />} />
          <Route path="catalog"   element={<CatalogHealth />} />
          <Route path="search"    element={<SearchComparison />} />
          <Route path="crosssell" element={<CrossSell />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CatalogProvider>
  )
}
