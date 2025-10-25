/**
 * Team Settings Page
 *
 * Purpose: Manage team members and invitations
 */

function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Team Members</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Invite and manage team members
          </p>
        </div>
        <button
          disabled
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Invite Member
        </button>
      </div>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Team management coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

export default TeamPage;
