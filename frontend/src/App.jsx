/**
 * Main App Component
 *
 * Purpose: Root routing and layout structure
 *
 * Routes:
 * - /login - Public login page
 * - /register - Public registration page
 * - /dashboard - Protected dashboard (requires auth)
 * - /conversations - Protected conversations page
 * - /settings - Protected settings (includes Inboxes tab)
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
import SettingsLayout from './pages/settings/SettingsLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ConversationsPage from './pages/conversations/ConversationsPage';

// Settings Pages
import ProvidersPage from './pages/settings/ProvidersPage';
import ChannelsPage from './pages/settings/ChannelsPage';
import InboxesPage from './pages/settings/InboxesPage';
import CompanyPage from './pages/settings/CompanyPage';
import TeamPage from './pages/settings/TeamPage';
import ProfilePage from './pages/settings/ProfilePage';

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
        <Route path="/conversations" element={<ConversationsPage />} />
      </Route>

      {/* Settings routes (nested) */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/settings/providers" replace />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="inboxes" element={<InboxesPage />} />
        <Route path="company" element={<CompanyPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Redirect root to dashboard or login */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
