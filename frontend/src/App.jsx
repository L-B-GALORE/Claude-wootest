/**
 * Main App Component
 *
 * Purpose: Root routing and layout structure
 *
 * Routes:
 * - /login - Public login page
 * - /register - Public registration page
 * - /verify-email - Public email verification page (magic link)
 * - /resend-verification - Public resend verification email page
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

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ResendVerificationPage from './pages/auth/ResendVerificationPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ConversationsPage from './pages/conversations/ConversationsPage';
import ContactsPage from './pages/contacts/ContactsPage';
import CallHistoryPage from './pages/calls/CallHistoryPage';

// Settings Pages (each has its own layout wrapper)
import ProvidersPage from './pages/settings/ProvidersPage';
import ChannelsPage from './pages/settings/ChannelsPage';
import InboxesPage from './pages/settings/InboxesPage';
import ProfilePage from './pages/settings/ProfilePage';
import TeamPage from './pages/settings/TeamPage';
import CompanyPage from './pages/settings/CompanyPage';

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
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/resend-verification" element={<ResendVerificationPage />} />
      </Route>

      {/* Protected routes - Dashboard */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/calls" element={<CallHistoryPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
      </Route>

      {/* Settings routes - each is independent with unique keys to force remounting */}
      <Route path="/settings" element={<Navigate to="/settings/providers" replace />} />
      <Route path="/settings/providers" element={<ProtectedRoute key="providers"><ProvidersPage key="providers-page" /></ProtectedRoute>} />
      <Route path="/settings/channels" element={<ProtectedRoute key="channels"><ChannelsPage key="channels-page" /></ProtectedRoute>} />
      <Route path="/settings/inboxes" element={<ProtectedRoute key="inboxes"><InboxesPage key="inboxes-page" /></ProtectedRoute>} />
      <Route path="/settings/company" element={<ProtectedRoute key="company"><CompanyPage key="company-page" /></ProtectedRoute>} />
      <Route path="/settings/team" element={<ProtectedRoute key="team"><TeamPage key="team-page" /></ProtectedRoute>} />
      <Route path="/settings/profile" element={<ProtectedRoute key="profile"><ProfilePage key="profile-page" /></ProtectedRoute>} />

      {/* Redirect root to dashboard or login */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
