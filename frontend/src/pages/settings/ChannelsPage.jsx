/**
 * Channels Settings Page
 *
 * Purpose: View and manage communication channels (phone numbers, email addresses)
 *
 * Features:
 * - List all channels grouped by type
 * - Show routing configuration
 * - Edit routing (future)
 * - Delete channels (future)
 */

import { useState, useEffect } from 'react';
import { Phone, Mail, Edit2 } from 'lucide-react';
import SettingsLayout from './SettingsLayout';
import api from '../../services/api';

function ChannelsPageContent() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  console.log('[ChannelsPage] Component rendered', { channelsCount: channels.length, loading });

  useEffect(() => {
    console.log('[ChannelsPage] useEffect FIRED - calling fetchChannels');
    fetchChannels();

    return () => {
      console.log('[ChannelsPage] Component UNMOUNTING');
    };
  }, []);

  const fetchChannels = async () => {
    console.log('[ChannelsPage] fetchChannels STARTED');
    setLoading(true);
    try {
      const response = await api.get('/api/v1/channels');
      console.log('[ChannelsPage] API response received:', response.data);
      if (response.data.success) {
        setChannels(response.data.data.channels);
        console.log('[ChannelsPage] Channels state SET:', response.data.data.channels);
      }
    } catch (error) {
      console.error('[ChannelsPage] Failed to fetch channels:', error);
    } finally {
      setLoading(false);
      console.log('[ChannelsPage] fetchChannels COMPLETED');
    }
  };

  const groupedChannels = {
    phone: channels.filter((c) => c.type === 'PHONE'),
    email: channels.filter((c) => c.type === 'EMAIL'),
  };

  const getRoutingLabel = (channel) => {
    if (channel.routingType === 'UNASSIGNED') {
      return <span className="text-gray-500">Unassigned</span>;
    }
    if (channel.routingType === 'INBOX') {
      return <span className="text-green-600 dark:text-green-400">→ Inbox</span>;
    }
    if (channel.routingType === 'USER') {
      return <span className="text-blue-600 dark:text-blue-400">→ User</span>;
    }
    return <span className="text-gray-500">Unknown</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Channels</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your communication channels and configure routing
        </p>
      </div>

      {channels.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12">
          <div className="text-center">
            <Phone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">No channels yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connect a provider and import channels to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Phone Channels */}
          {groupedChannels.phone.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Numbers ({groupedChannels.phone.length})
              </h3>
              <div className="space-y-2">
                {groupedChannels.phone.map((channel) => (
                  <div
                    key={channel.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {channel.identifier}
                          </span>
                          {channel.status === 'ACTIVE' ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Routing: {getRoutingLabel(channel)}
                          </span>
                          {channel.capabilities?.voice && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">• Voice</span>
                          )}
                          {channel.capabilities?.sms && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">• SMS</span>
                          )}
                          {channel.capabilities?.mms && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">• MMS</span>
                          )}
                        </div>
                      </div>
                      <button
                        disabled
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        title="Edit routing (coming soon)"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Channels */}
          {groupedChannels.email.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Addresses ({groupedChannels.email.length})
              </h3>
              <div className="space-y-2">
                {groupedChannels.email.map((channel) => (
                  <div
                    key={channel.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-900 dark:text-white">{channel.identifier}</span>
                      <button
                        disabled
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChannelsPage() {
  return (
    <SettingsLayout>
      <ChannelsPageContent />
    </SettingsLayout>
  );
}

export default ChannelsPage;
