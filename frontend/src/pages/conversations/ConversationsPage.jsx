/**
 * Conversations Page
 *
 * Purpose: Main page for viewing and managing customer conversations
 *
 * Features:
 * - List of active conversations
 * - Conversation thread view
 * - Real-time updates via WebSocket
 * - Multi-channel support (voice, SMS, email, etc.)
 *
 * BEFORE MODIFYING:
 * - Will this change affect real-time message delivery?
 * - Does this break the WebSocket connection?
 * - Are we handling all conversation types?
 */

import { useAuth } from '../../context/AuthContext';

function ConversationsPage() {
  const { user } = useAuth();

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Conversations
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage customer communications across all channels
        </p>
      </div>

      {/* Empty State */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No conversations yet
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Get started by connecting a provider and creating an inbox.
          </p>
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 text-left">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">1</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Connect Twilio
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Go to Settings → Providers and connect your Twilio account
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-left">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-400">2</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400">
                  Create an inbox
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Set up inboxes and assign phone numbers to them
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-left">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-400">3</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400">
                  Start communicating
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive calls and messages from your customers
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConversationsPage;
