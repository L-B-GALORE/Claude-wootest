/**
 * Company Settings Page
 *
 * Purpose: Manage company information
 */

import { useAuth } from '../../context/AuthContext';

function CompanyPage() {
  const { company } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Company Information</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Update your company details</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Company Name
        </label>
        <input
          type="text"
          value={company?.name || ''}
          disabled
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Contact support to change your company name
        </p>
      </div>
    </div>
  );
}

export default CompanyPage;
