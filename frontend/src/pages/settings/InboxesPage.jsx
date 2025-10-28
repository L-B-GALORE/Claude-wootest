/**
 * Inboxes Settings Page
 *
 * Purpose: Manage inboxes for organizing conversations
 *
 * Features:
 * - List all inboxes
 * - Create new inbox
 * - Delete inbox
 * - Configure routing
 * - Manage members
 * - View member counts
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Settings, Users } from 'lucide-react';
import CreateInboxModal from '../../components/modals/CreateInboxModal';
import ConfigureRoutingModal from '../../components/modals/ConfigureRoutingModal';
import ManageMembersModal from '../../components/modals/ManageMembersModal';
import SettingsLayout from './SettingsLayout';
import api from '../../services/api';

function InboxesPageContent() {
  const [inboxes, setInboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState(null);

  useEffect(() => {
    fetchInboxes();
  }, []);

  const fetchInboxes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/inboxes');
      if (response.data.success) {
        setInboxes(response.data.data.inboxes);
      }
    } catch (error) {
      console.error('Failed to fetch inboxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInboxCreated = () => {
    setShowCreateModal(false);
    fetchInboxes();
  };

  const handleConfigureRouting = (inbox) => {
    setSelectedInbox(inbox);
    setShowRoutingModal(true);
  };

  const handleRoutingConfigured = () => {
    setShowRoutingModal(false);
    setSelectedInbox(null);
    fetchInboxes();
  };

  const handleManageMembers = (inbox) => {
    setSelectedInbox(inbox);
    setShowMembersModal(true);
  };

  const handleMembersUpdated = () => {
    setShowMembersModal(false);
    setSelectedInbox(null);
    fetchInboxes();
  };

  const handleDeleteInbox = async (inboxId) => {
    if (!confirm('Are you sure you want to delete this inbox? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/v1/inboxes/${inboxId}`);
      if (response.data.success) {
        fetchInboxes();
      }
    } catch (error) {
      console.error('Failed to delete inbox:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to delete inbox';
      alert(errorMessage);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Inboxes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Organize conversations by team or department
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Create Inbox
        </button>
      </div>

      {inboxes.length === 0 ? (
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
                    <button
                      onClick={() => handleManageMembers(inbox)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      <Users className="w-3 h-3" />
                      {inbox.memberCount} member{inbox.memberCount !== 1 ? 's' : ''}
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {inbox.channelCount || 0} channel{(inbox.channelCount || 0) !== 1 ? 's' : ''} connected
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Created {new Date(inbox.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleConfigureRouting(inbox)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Configure routing"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
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

      <CreateInboxModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleInboxCreated}
      />

      <ConfigureRoutingModal
        isOpen={showRoutingModal}
        onClose={() => setShowRoutingModal(false)}
        inbox={selectedInbox}
        onSuccess={handleRoutingConfigured}
      />

      <ManageMembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        inbox={selectedInbox}
        onSuccess={handleMembersUpdated}
      />
    </div>
  );
}

function InboxesPage() {
  return (
    <SettingsLayout>
      <InboxesPageContent />
    </SettingsLayout>
  );
}

export default InboxesPage;
