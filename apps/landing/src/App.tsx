import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LangProvider } from './i18n/LangContext';
import LandingPage from './pages/LandingPage';
import BlogArticleFi from './pages/BlogArticleFi';

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/blog/krypto-verotus-suomi-2026" element={<BlogArticleFi />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}
