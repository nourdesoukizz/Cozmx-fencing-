import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { NotificationProvider } from './context/NotificationContext';
import LandingPage from './components/landing/LandingPage';
import DashboardPage from './components/dashboard/DashboardPage';
import PublicPage from './components/public/PublicPage';
import CoachPage from './components/coach/CoachPage';
import RefereePortal from './components/referee/RefereePortal';

function ProtectedRoute({ sessionKey, children }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem(sessionKey) !== 'true') {
      navigate('/', { replace: true });
    }
  }, [sessionKey, navigate]);

  if (sessionStorage.getItem(sessionKey) !== 'true') {
    return null;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute sessionKey="role_bout_committee">
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/public" element={<PublicPage />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/referee" element={<RefereePortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}
