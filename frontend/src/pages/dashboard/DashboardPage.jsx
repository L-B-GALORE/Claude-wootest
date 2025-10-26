/**
 * Dashboard Page
 *
 * Purpose: Main dashboard landing page
 *
 * Features:
 * - Welcome message with user info
 * - Quick stats overview
 * - Recent activity placeholder
 *
 * BEFORE MODIFYING:
 * - Will this change affect the dashboard layout?
 * - Are we adding real-time data that needs WebSocket?
 * - Does this require new API endpoints?
 */

import { useAuth } from '../../context/AuthContext';

function DashboardPage() {
  const { user, company } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {company?.name} Dashboard
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Active Conversations
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Connected Channels
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">0</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Team Members
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">1</p>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Getting Started
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">1</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Connect a provider
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect your Twilio account to start receiving calls and messages
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-400">2</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-400">
                Create an inbox
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Organize your communications by creating inboxes for different teams
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-400">3</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-400">
                Invite team members
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add your team and assign them to inboxes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
