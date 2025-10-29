/**
 * Call History Page
 *
 * Purpose: Display all voice calls with filtering and details
 *
 * Features:
 * - List all calls
 * - Filter by date range, contact, inbox, status
 * - View call details (duration, recording, etc.)
 * - Listen to call recordings
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, User, Calendar } from 'lucide-react';
import api from '../../services/api';

function CallHistoryPage() {
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
  });

  // Fetch calls
  const { data: callsData, isLoading } = useQuery({
    queryKey: ['calls', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.append('dateTo', new Date(filters.dateTo).toISOString());
      params.append('limit', '100');

      const response = await api.get(`/api/v1/calls?${params}`);
      return response.data.data;
    },
  });

  const calls = callsData?.calls || [];

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status) => {
    const colors = {
      COMPLETED: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
      FAILED: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
      NO_ANSWER: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
      BUSY: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
      RINGING: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
      IN_PROGRESS: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
    };
    return colors[status] || 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Call History</h1>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="BUSY">Busy</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', dateFrom: '', dateTo: '' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Calls List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            Loading calls...
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Phone className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p>No calls found</p>
            <p className="text-sm mt-2">Calls will appear here after incoming or outgoing calls</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <div
                key={call.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  {/* Call Info */}
                  <div className="flex items-start gap-4 flex-1">
                    {/* Direction Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      call.direction === 'INBOUND' ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-green-100 dark:bg-green-900/20'
                    }`}>
                      {call.direction === 'INBOUND' ? (
                        <PhoneIncoming className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <PhoneOutgoing className="w-5 h-5 text-green-600 dark:text-green-400" />
                      )}
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {call.contact?.name || call.contact?.phoneNumber || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{call.channel?.phoneNumber}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(call.createdAt)}</span>
                        </div>
                        {call.durationSeconds > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(call.durationSeconds)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(call.callStatus)}`}>
                      {call.callStatus.replace('_', ' ')}
                    </span>

                    {call.recordingUrl && (
                      <a
                        href={call.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Listen to Recording
                      </a>
                    )}
                  </div>
                </div>

                {/* Additional Details */}
                {call.providerCallId && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Call ID: {call.providerCallId}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CallHistoryPage;
