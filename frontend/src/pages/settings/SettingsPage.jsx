/**
 * Settings Page
 *
 * Purpose: Company and user settings management
 *
 * Features:
 * - Provider connection (Twilio, Gmail, etc.)
 * - Company settings
 * - User preferences
 * - Team management
 *
 * BEFORE MODIFYING:
 * - Will this change affect provider credentials?
 * - Are we adding new integrations?
 * - Does this require encryption changes?
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function SettingsPage() {
  const { user, company } = useAuth();
  const [activeTab, setActiveTab] = useState('providers');

  const tabs = [
    { id: 'providers', label: 'Providers' },
    { id: 'company', label: 'Company' },
    { id: 'team', label: 'Team' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your company settings and integrations
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Communication Providers
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your Twilio, Gmail, or other communication providers
              </p>
            </div>

            {/* Twilio Provider */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Twilio
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Voice calls, SMS, and WhatsApp messaging
                    </p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mt-2">
                      Not connected
                    </span>
                  </div>
                </div>
                <button className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                  Connect
                </button>
              </div>
            </div>

            {/* Gmail Provider (coming soon) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Gmail
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Email support and conversations
                    </p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mt-2">
                      Coming soon
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'company' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Company Information
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Update your company details
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={company?.name || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Team Members
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Invite and manage your team
              </p>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              Team management coming soon...
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Your Profile
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Update your personal information
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={user?.name || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
