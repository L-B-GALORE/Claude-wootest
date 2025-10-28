/**
 * Manage Members Modal
 *
 * Purpose: Add/remove users from inbox
 *
 * Features:
 * - Show current members
 * - Show available users to add
 * - Add member to inbox
 * - Remove member from inbox
 */

import { useState, useEffect } from 'react';
import { X, UserPlus, UserMinus, Users } from 'lucide-react';
import api from '../../services/api';

function ManageMembersModal({ isOpen, onClose, inbox, onSuccess }) {
  const [members, setMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && inbox) {
      fetchData();
    }
  }, [isOpen, inbox]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch inbox details with members
      const inboxResponse = await api.get(`/api/v1/inboxes/${inbox.id}`);

      // Fetch all users in company
      const usersResponse = await api.get('/api/v1/users');

      if (inboxResponse.data.success && usersResponse.data.success) {
        const inboxData = inboxResponse.data.data.inbox;
        const allUsers = usersResponse.data.data.users;

        setMembers(inboxData.members || []);

        // Filter out users who are already members
        const memberUserIds = new Set((inboxData.members || []).map(m => m.userId));
        const available = allUsers.filter(user => !memberUserIds.has(user.id));
        setAvailableUsers(available);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    try {
      const response = await api.post(`/api/v1/inboxes/${inbox.id}/members`, {
        userId,
      });

      if (response.data.success) {
        await fetchData(); // Refresh the lists
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to add member';
      setError(errorMessage);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member from the inbox?')) {
      return;
    }

    try {
      const response = await api.delete(`/api/v1/inboxes/${inbox.id}/members/${userId}`);

      if (response.data.success) {
        await fetchData(); // Refresh the lists
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to remove member';
      setError(errorMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Manage Members
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {inbox?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Current Members */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Current Members ({members.length})
                </h3>
                {members.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No members yet. Add users to this inbox.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                              {member.user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {member.user.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {member.user.email}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Remove member"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Users to Add */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add Members ({availableUsers.length} available)
                </h3>
                {availableUsers.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <UserPlus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      All users are already members of this inbox.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddMember(user.id)}
                          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Add member"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageMembersModal;
