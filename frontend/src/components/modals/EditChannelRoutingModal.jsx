/**
 * Edit Channel Routing Modal
 *
 * Purpose: Configure where incoming communications are routed
 *
 * Routing options:
 * - UNASSIGNED: Channel exists but doesn't route anywhere
 * - INBOX: Routes to a team inbox
 * - USER: Routes to a specific user (private line)
 */

import { useState, useEffect } from 'react';
import { X, Phone, Inbox, User } from 'lucide-react';
import api from '../../services/api';

function EditChannelRoutingModal({ isOpen, onClose, channel, onSuccess }) {
  const [routingType, setRoutingType] = useState('UNASSIGNED');
  const [routingTargetId, setRoutingTargetId] = useState('');
  const [inboxes, setInboxes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    if (isOpen && channel) {
      // Set initial routing values from channel
      setRoutingType(channel.routingType || 'UNASSIGNED');
      setRoutingTargetId(channel.routingTargetId || '');

      // Fetch inboxes and users for dropdowns
      fetchRoutingOptions();
    }
  }, [isOpen, channel]);

  const fetchRoutingOptions = async () => {
    setFetchingData(true);
    try {
      const [inboxesRes, usersRes] = await Promise.all([
        api.get('/api/v1/inboxes'),
        api.get('/api/v1/users'),
      ]);

      if (inboxesRes.data.success) {
        setInboxes(inboxesRes.data.data.inboxes);
      }

      if (usersRes.data.success) {
        setUsers(usersRes.data.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch routing options:', error);
    } finally {
      setFetchingData(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        routingType,
        routingTargetId: routingType === 'UNASSIGNED' ? null : routingTargetId,
      };

      const response = await api.patch(
        `/api/v1/channels/${channel.id}/routing`,
        payload
      );

      if (response.data.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Failed to update channel routing:', error);
      alert(error.response?.data?.error?.message || 'Failed to update routing');
    } finally {
      setLoading(false);
    }
  };

  const handleRoutingTypeChange = (newType) => {
    setRoutingType(newType);
    // Clear target when changing type
    if (newType === 'UNASSIGNED') {
      setRoutingTargetId('');
    }
  };

  if (!isOpen || !channel) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Configure Routing
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {channel.identifier}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fetchingData ? (
            <div className="flex items-center justify-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Routing Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Route to
                </label>
                <div className="space-y-2">
                  {/* Unassigned */}
                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                    <input
                      type="radio"
                      name="routingType"
                      value="UNASSIGNED"
                      checked={routingType === 'UNASSIGNED'}
                      onChange={(e) => handleRoutingTypeChange(e.target.value)}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Unassigned
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Don't route incoming communications
                      </div>
                    </div>
                  </label>

                  {/* Inbox */}
                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                    <input
                      type="radio"
                      name="routingType"
                      value="INBOX"
                      checked={routingType === 'INBOX'}
                      onChange={(e) => handleRoutingTypeChange(e.target.value)}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <Inbox className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Team Inbox
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Route to a shared team inbox
                      </div>
                    </div>
                  </label>

                  {/* User */}
                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                    <input
                      type="radio"
                      name="routingType"
                      value="USER"
                      checked={routingType === 'USER'}
                      onChange={(e) => handleRoutingTypeChange(e.target.value)}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <User className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Specific User
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Route to a user's private line
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Inbox Selector */}
              {routingType === 'INBOX' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Inbox
                  </label>
                  {inboxes.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      No inboxes available. Create an inbox first.
                    </div>
                  ) : (
                    <select
                      value={routingTargetId}
                      onChange={(e) => setRoutingTargetId(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Choose an inbox...</option>
                      {inboxes.map((inbox) => (
                        <option key={inbox.id} value={inbox.id}>
                          {inbox.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* User Selector */}
              {routingType === 'USER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select User
                  </label>
                  {users.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      No users available.
                    </div>
                  ) : (
                    <select
                      value={routingTargetId}
                      onChange={(e) => setRoutingTargetId(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Choose a user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || fetchingData || (routingType !== 'UNASSIGNED' && !routingTargetId)}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save Routing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditChannelRoutingModal;
