import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConnectTwilioModal from '../../components/modals/ConnectTwilioModal';
import ImportNumbersModal from '../../components/modals/ImportNumbersModal';
import CreateInboxModal from '../../components/modals/CreateInboxModal';
import { Phone, MessageSquare, Mail, Edit2, Trash2 } from 'lucide-react';
import api from '../../services/api';

function SettingsPage() {
  const { user, company } = useAuth();
  const [activeTab, setActiveTab] = useState('providers');
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [inboxes, setInboxes] = useState([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);
  const [showCreateInboxModal, setShowCreateInboxModal] = useState(false);

  const tabs = [
    { id: 'providers', label: 'Providers' },
    { id: 'channels', label: 'Channels' },
    { id: 'inboxes', label: 'Inboxes' },
    { id: 'company', label: 'Company' },
    { id: 'team', label: 'Team' },
    { id: 'profile', label: 'Profile' },
  ];

  // Fetch data on initial mount
  useEffect(() => {
    fetchProviders();
  }, []);

  // Fetch data when switching tabs
  useEffect(() => {
    if (activeTab === 'providers') {
      fetchProviders();
    } else if (activeTab === 'channels') {
      fetchChannels();
    } else if (activeTab === 'inboxes') {
      fetchInboxes();
    }
  }, [activeTab]);

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const response = await api.get('/api/v1/providers');
      if (response.data.success) {
        setProviders(response.data.data.providers);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const response = await api.get('/api/v1/channels');
      if (response.data.success) {
        setChannels(response.data.data.channels);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const fetchInboxes = async () => {
    setLoadingInboxes(true);
    try {
      const response = await api.get('/api/v1/inboxes');
      if (response.data.success) {
        setInboxes(response.data.data.inboxes);
      }
    } catch (error) {
      console.error('Failed to fetch inboxes:', error);
    } finally {
      setLoadingInboxes(false);
    }
  };

  const handleInboxCreated = (inbox) => {
    setInboxes([...inboxes, inbox]);
  };

  const handleDeleteInbox = async (inboxId) => {
    if (!confirm('Are you sure you want to delete this inbox? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/v1/inboxes/${inboxId}`);
      if (response.data.success) {
        setInboxes(inboxes.filter((inbox) => inbox.id !== inboxId));
      }
    } catch (error) {
      console.error('Failed to delete inbox:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to delete inbox';
      alert(errorMessage);
    }
  };

  const handleTwilioConnected = () => {
    fetchProviders();
  };

  const handleNumbersImported = () => {
    fetchChannels();
    setShowImportModal(false);
  };

  const handleOpenImport = (provider) => {
    setSelectedProvider(provider);
    setShowImportModal(true);
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
    return channel.routingType;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your company settings and integrations
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

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

            {loadingProviders ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <>
                {(() => {
                  const twilioProvider = providers.find((p) => p.type === 'TWILIO');
                  return (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Twilio</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Voice calls, SMS, and WhatsApp messaging
                            </p>
                            {twilioProvider ? (
                              <>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 mt-2">
                                  Connected • {twilioProvider.channelCount} channel{twilioProvider.channelCount !== 1 ? 's' : ''}
                                </span>
                                <button
                                  onClick={() => handleOpenImport(twilioProvider)}
                                  className="ml-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                >
                                  Import numbers
                                </button>
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mt-2">
                                Not connected
                              </span>
                            )}
                          </div>
                        </div>
                        {!twilioProvider && (
                          <button
                            onClick={() => setShowTwilioModal(true)}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-50">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">Gmail</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Email support and conversations
                      </p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mt-2">
                        Coming soon
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Channels</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All communication channels across all providers
              </p>
            </div>

            {loadingChannels ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">No channels yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect a provider and import your phone numbers to get started
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedChannels.phone.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Phone Numbers ({groupedChannels.phone.length})
                    </h3>
                    <div className="space-y-2">
                      {groupedChannels.phone.map((channel) => (
                        <div
                          key={channel.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {channel.identifier}
                                  </span>
                                  {getRoutingLabel(channel)}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  Provider: {channel.provider.type}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  {channel.capabilities.voice && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                      Voice
                                    </span>
                                  )}
                                  {channel.capabilities.sms && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                      SMS
                                    </span>
                                  )}
                                  {channel.capabilities.mms && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                      MMS
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
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
        )}

        {activeTab === 'inboxes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Inboxes</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Organize conversations by team or department
                </p>
              </div>
              <button
                onClick={() => setShowCreateInboxModal(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Create Inbox
              </button>
            </div>

            {loadingInboxes ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12">
                <div className="text-center">
                  <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-primary-600 rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Loading inboxes...</p>
                </div>
              </div>
            ) : inboxes.length === 0 ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">No inboxes yet</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Create your first inbox to organize customer conversations
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {inboxes.map((inbox) => (
                  <div
                    key={inbox.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white">
                          {inbox.name}
                        </h3>
                        {inbox.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {inbox.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {inbox.memberCount} member{inbox.memberCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Created {new Date(inbox.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleDeleteInbox(inbox.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete inbox"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'company' && (
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Team Members</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Invite and manage your team</p>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Team management coming soon...</div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your Profile</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Update your personal information</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
              <input
                type="text"
                value={user?.name || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
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

      <ConnectTwilioModal
        isOpen={showTwilioModal}
        onClose={() => setShowTwilioModal(false)}
        onSuccess={handleTwilioConnected}
      />

      <ImportNumbersModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        providerId={selectedProvider?.id}
        onSuccess={handleNumbersImported}
      />

      <CreateInboxModal
        isOpen={showCreateInboxModal}
        onClose={() => setShowCreateInboxModal(false)}
        onSuccess={handleInboxCreated}
      />
    </div>
  );
}

export default SettingsPage;
