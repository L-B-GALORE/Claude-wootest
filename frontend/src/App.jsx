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

// Components
import ErrorBoundary from './components/ErrorBoundary';

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
import AdminPage from './pages/admin/AdminPage';

// Settings Pages (each has its own layout wrapper)
import ProvidersPage from './pages/settings/ProvidersPage';
import ChannelsPage from './pages/settings/ChannelsPage';
import InboxesPage from './pages/settings/InboxesPage';
import ProfilePage from './pages/settings/ProfilePage';
import TeamPage from './pages/settings/TeamPage';
import CompanyPage from './pages/settings/CompanyPage';
import NotificationsPage from './pages/settings/NotificationsPage';

// Debug Pages
import DebugTwilio from './pages/DebugTwilio';

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
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/resend-verification" element={<ResendVerificationPage />} />
        </Route>

        {/* Admin route - Full page layout */}
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

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

          {/* Settings routes - now inside DashboardLayout to show sidebar and call widget */}
          <Route path="/settings" element={<Navigate to="/settings/providers" replace />} />
          <Route path="/settings/providers" element={<ProvidersPage key="providers-page" />} />
          <Route path="/settings/channels" element={<ChannelsPage key="channels-page" />} />
          <Route path="/settings/inboxes" element={<InboxesPage key="inboxes-page" />} />
          <Route path="/settings/company" element={<CompanyPage key="company-page" />} />
          <Route path="/settings/team" element={<TeamPage key="team-page" />} />
          <Route path="/settings/profile" element={<ProfilePage key="profile-page" />} />
          <Route path="/settings/notifications" element={<NotificationsPage key="notifications-page" />} />
        </Route>

        {/* Debug routes */}
        <Route path="/debug/twilio" element={<ProtectedRoute><DebugTwilio /></ProtectedRoute>} />

        {/* Redirect root to dashboard or login */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
