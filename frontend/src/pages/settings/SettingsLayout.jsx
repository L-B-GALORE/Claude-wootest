/**
 * Settings Layout
 *
 * Purpose: Layout wrapper for settings pages with navigation sidebar
 *
 * Features:
 * - Sidebar navigation
 * - Active link highlighting
 * - Nested route outlet
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Settings, Inbox, Phone, Building2, Users, User } from 'lucide-react';

function SettingsLayout() {
  const location = useLocation();

  const navItems = [
    { path: '/settings/providers', label: 'Providers', icon: Settings },
    { path: '/settings/channels', label: 'Channels', icon: Phone },
    { path: '/settings/inboxes', label: 'Inboxes', icon: Inbox },
    { path: '/settings/company', label: 'Company', icon: Building2 },
    { path: '/settings/team', label: 'Team', icon: Users },
    { path: '/settings/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your account and application settings
          </p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <Outlet key={location.pathname} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsLayout;
