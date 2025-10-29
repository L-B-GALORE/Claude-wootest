/**
 * Contacts Page
 *
 * Purpose: Display and manage all contacts (people who have called/messaged)
 *
 * Features:
 * - List all contacts
 * - Search contacts by name, phone, email
 * - View contact details
 * - Edit contact information
 * - View contact communication history
 * - Delete contacts
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Search, Phone, Mail, MessageSquare, Trash2, Pen } from 'lucide-react';
import api from '../../services/api';

function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch contacts
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', '100');

      const response = await api.get(`/api/v1/contacts?${params}`);
      return response.data.data;
    },
  });

  // Fetch contact history when a contact is selected
  const { data: historyData } = useQuery({
    queryKey: ['contact-history', selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact) return null;
      const response = await api.get(`/api/v1/contacts/${selectedContact.id}/history`);
      return response.data.data;
    },
    enabled: !!selectedContact,
  });

  // Delete contact mutation
  const deleteMutation = useMutation({
    mutationFn: async (contactId) => {
      await api.delete(`/api/v1/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      setSelectedContact(null);
    },
  });

  const contacts = contactsData?.contacts || [];
  const conversations = historyData?.conversations || [];

  const handleDeleteContact = async (contact) => {
    if (confirm(`Are you sure you want to delete ${contact.name || contact.phoneNumber}?`)) {
      await deleteMutation.mutateAsync(contact.id);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900">
      {/* Contacts List */}
      <div className="w-96 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Contacts</h1>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No contacts found' : 'No contacts yet. They will appear here after calls or messages.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedContact?.id === contact.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {contact.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {contact.phoneNumber}
                      </p>
                      {contact.email && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 truncate">
                          {contact.email}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {contact.conversationCount} conversation{contact.conversationCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact Details */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Contact Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedContact.name || 'Unknown'}
                    </h2>
                    <div className="mt-2 space-y-1">
                      {selectedContact.phoneNumber && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Phone className="w-4 h-4" />
                          <span>{selectedContact.phoneNumber}</span>
                        </div>
                      )}
                      {selectedContact.email && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Mail className="w-4 h-4" />
                          <span>{selectedContact.email}</span>
                        </div>
                      )}
                    </div>
                    {selectedContact.notes && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {selectedContact.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Pen className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteContact(selectedContact)}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Communication History */}
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Communication History
              </h3>

              {conversations.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No communications yet
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {conversation.type === 'TRANSACTIONAL' ? 'Voice Call' : 'SMS Conversation'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            via {conversation.channel.phoneNumber}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-500">
                          {formatDate(conversation.lastMessageAt)}
                        </span>
                      </div>

                      {/* Messages */}
                      <div className="space-y-2">
                        {conversation.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className="text-sm bg-gray-50 dark:bg-gray-700 rounded p-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${
                                msg.direction === 'INBOUND' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                              }`}>
                                {msg.direction === 'INBOUND' ? 'Incoming' : 'Outgoing'}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">
                                {formatDate(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 mt-1">
                              {msg.body}
                            </p>
                            {msg.voiceCall && (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                Status: {msg.voiceCall.callStatus}
                                {msg.voiceCall.durationSeconds && (
                                  <> • Duration: {formatDuration(msg.voiceCall.durationSeconds)}</>
                                )}
                                {msg.voiceCall.recordingUrl && (
                                  <> • <a href={msg.voiceCall.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">Recording</a></>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p>Select a contact to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Contact Modal */}
      {isEditModalOpen && selectedContact && (
        <EditContactModal
          contact={selectedContact}
          onClose={() => setIsEditModalOpen(false)}
          onSave={() => {
            queryClient.invalidateQueries(['contacts']);
            queryClient.invalidateQueries(['contact-history', selectedContact.id]);
            setIsEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Edit Contact Modal Component
function EditContactModal({ contact, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: contact.name || '',
    email: contact.email || '',
    notes: contact.notes || '',
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      await api.put(`/api/v1/contacts/${contact.id}`, data);
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateMutation.mutateAsync(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Contact</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={contact.phoneNumber}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Phone number cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Add notes about this contact..."
            />
          </div>

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
              disabled={updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContactsPage;
