/**
 * Contacts Page
 *
 * Purpose: Display and manage all contacts in a table view
 *
 * Features:
 * - Table view of all contacts
 * - Search contacts by name, phone, email
 * - View/edit contact details
 * - Delete contacts
 * - Create new contacts manually
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Search, Phone, Mail, Trash2, Pen, Plus, X } from 'lucide-react';
import api from '../../services/api';

function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  const handleDeleteContact = async (contact) => {
    if (confirm(`Are you sure you want to delete ${contact.name || contact.phoneNumber}?`)) {
      await deleteMutation.mutateAsync(contact.id);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contacts</h1>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Contact
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg mb-2">
                {searchQuery ? 'No contacts found' : 'No contacts yet'}
              </p>
              <p className="text-sm">
                {searchQuery ? 'Try a different search term' : 'Contacts will appear here after calls or messages, or you can create them manually.'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Conversations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Contact
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0 mr-3">
                          <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {contact.name || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        {contact.phoneNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.email ? (
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          {contact.email}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        {contact.callCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {contact.conversationCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(contact.lastContactAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 mr-4"
                      >
                        <Pen className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Contact Modal */}
      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onSave={() => {
            queryClient.invalidateQueries(['contacts']);
            setSelectedContact(null);
          }}
        />
      )}

      {/* Create Contact Modal */}
      {isCreateModalOpen && (
        <ContactModal
          onClose={() => setIsCreateModalOpen(false)}
          onSave={() => {
            queryClient.invalidateQueries(['contacts']);
            setIsCreateModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Contact Modal Component (for both create and edit)
function ContactModal({ contact, onClose, onSave }) {
  const isEdit = !!contact;
  const [formData, setFormData] = useState({
    name: contact?.name || '',
    phoneNumber: contact?.phoneNumber || '',
    email: contact?.email || '',
    notes: contact?.notes || '',
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        // Update existing contact
        const { phoneNumber, ...updateData } = data; // Can't update phone number
        await api.put(`/api/v1/contacts/${contact.id}`, updateData);
      } else {
        // Create new contact
        await api.post(`/api/v1/contacts`, data);
      }
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate phone number for new contacts
    if (!isEdit && !formData.phoneNumber) {
      alert('Phone number is required');
      return;
    }

    await saveMutation.mutateAsync(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Contact' : 'New Contact'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              Phone Number {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              disabled={isEdit}
              required={!isEdit}
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                isEdit
                  ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
              placeholder="+1234567890"
            />
            {isEdit && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Phone number cannot be changed
              </p>
            )}
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
              placeholder="email@example.com"
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
              disabled={saveMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContactsPage;
