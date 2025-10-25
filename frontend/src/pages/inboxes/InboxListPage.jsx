/**
 * Inbox List Page
 *
 * Purpose: Display and manage inboxes
 *
 * Features:
 * - List all inboxes for the company
 * - Create new inbox
 * - View inbox details
 * - Assign channels and team members
 *
 * BEFORE MODIFYING:
 * - Will this change affect inbox routing?
 * - Are we updating the inbox assignment logic?
 * - Does this require new permissions checks?
 */

import { useAuth } from '../../context/AuthContext';

function InboxListPage() {
  const { company } = useAuth();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Inboxes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your communication channels and team assignments
          </p>
        </div>
        <button
          disabled
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Create Inbox
        </button>
      </div>

      {/* Empty State */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No inboxes yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by connecting a provider in Settings, then create your first inbox.
          </p>
          <div className="mt-6">
            <button
              disabled
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Create your first inbox
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">
              What are inboxes?
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p>
                Inboxes help you organize customer conversations by team or department.
                Assign phone numbers, email addresses, and chat channels to different inboxes,
                and control which team members can access each inbox.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InboxListPage;
