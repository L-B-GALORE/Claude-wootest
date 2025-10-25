/**
 * Main App Component
 *
 * Purpose: Root routing and layout structure
 *
 * Routes:
 * - /login - Public login page
 * - /register - Public registration page
 * - /dashboard - Protected dashboard (requires auth)
 * - /inboxes - Protected inbox management
 * - /settings - Protected settings
 *
 * BEFORE MODIFYING:
 * - Will this change affect the routing structure?
 * - Are new routes properly protected with ProtectedRoute?
 * - Does this break existing navigation?
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import InboxListPage from './pages/inboxes/InboxListPage';
import SettingsPage from './pages/settings/SettingsPage';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/inboxes" element={<InboxListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Redirect root to dashboard or login */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
