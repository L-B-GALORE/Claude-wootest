/**
 * Conversations Page
 *
 * Purpose: Threaded SMS messaging interface
 *
 * Features:
 * - Left panel: List of conversations
 * - Right panel: Message thread (chronological, latest at bottom)
 * - Send new SMS messages
 * - Real-time updates via WebSocket
 */

import { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, User, Phone, Clock, MoreVertical, Trash2, Info, Check, CheckCheck, XCircle, AlertCircle, CheckCircle2, XOctagon, Loader2 } from 'lucide-react';
import api from '../../services/api';
import socketManager from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

function ConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('OPEN'); // OPEN, CLOSED, BOTH
  const selectedConversationIdRef = useRef(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Keep ref in sync with state
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // Fetch conversations list with pagination
  const {
    data: conversationsData,
    isLoading: loadingConversations,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['conversations', statusFilter],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await api.get(`/api/v1/conversations?status=${statusFilter}&limit=20&offset=${pageParam}`);
      return response.data.data;
    },
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((sum, page) => sum + page.conversations.length, 0);
      return totalFetched < lastPage.total ? totalFetched : undefined;
    },
    refetchInterval: 60000,
  });

  // Flatten paginated conversations
  const conversations = conversationsData?.pages.flatMap((page) => page.conversations) || [];

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // WebSocket connection and event listeners
  useEffect(() => {
    if (!user?.id || !user?.companyId) return;

    console.log('[ConversationsPage] Connecting WebSocket...');

    // Connect WebSocket
    socketManager.connect(user.id, user.companyId);

    // Handle new incoming messages
    const handleNewMessage = (data) => {
      console.log('[ConversationsPage] Received new_message event:', data);

      // Refresh conversation list
      queryClient.invalidateQueries(['conversations']);

      // If viewing this conversation, refresh it
      const currentConversationId = selectedConversationIdRef.current;
      if (data.conversationId === currentConversationId) {
        queryClient.invalidateQueries(['conversation', currentConversationId]);
      }
    };

    // Handle outbound messages sent
    const handleMessageSent = (data) => {
      console.log('[ConversationsPage] Received message_sent event:', data);

      // Refresh conversation list
      queryClient.invalidateQueries(['conversations']);

      // If viewing this conversation, refresh it immediately
      const currentConversationId = selectedConversationIdRef.current;
      console.log('[ConversationsPage] Message sent - Current conversation:', currentConversationId, 'Event conversation:', data.conversationId);

      if (data.conversationId === currentConversationId) {
        console.log('[ConversationsPage] Refetching conversation after message sent');
        queryClient.refetchQueries(['conversation', currentConversationId]);
      }
    };

    // Handle message status updates
    const handleStatusUpdate = (data) => {
      console.log('[ConversationsPage] Received message_status_updated event:', data);

      // If viewing this conversation, refresh it to show updated status
      const currentConversationId = selectedConversationIdRef.current;
      console.log('[ConversationsPage] Current conversation:', currentConversationId, 'Event conversation:', data.conversationId);

      if (data.conversationId === currentConversationId) {
        console.log('[ConversationsPage] Refetching conversation data immediately');
        queryClient.refetchQueries(['conversation', currentConversationId]);
      }
    };

    // Handle conversation status updates (OPEN/CLOSED)
    const handleConversationStatusUpdate = (data) => {
      console.log('[ConversationsPage] Received conversation_status_updated event:', data);

      // Refetch all conversation lists (could be moving between filters)
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      // If viewing this conversation, refresh it
      const currentConversationId = selectedConversationIdRef.current;
      if (data.conversationId === currentConversationId) {
        queryClient.refetchQueries(['conversation', currentConversationId]);
      }
    };

    // Subscribe to events
    socketManager.on('new_message', handleNewMessage);
    socketManager.on('message_sent', handleMessageSent);
    socketManager.on('message_status_updated', handleStatusUpdate);
    socketManager.on('conversation_status_updated', handleConversationStatusUpdate);

    // Cleanup on unmount
    return () => {
      console.log('[ConversationsPage] Cleaning up WebSocket listeners');
      socketManager.off('new_message', handleNewMessage);
      socketManager.off('message_sent', handleMessageSent);
      socketManager.off('message_status_updated', handleStatusUpdate);
      socketManager.off('conversation_status_updated', handleConversationStatusUpdate);
    };
  }, [user, queryClient]); // queryClient is stable, selectedConversationId tracked via ref

  return (
    <div className="h-full flex bg-gray-100 dark:bg-gray-900">
      {/* Left Panel - Conversation List */}
      <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>

          {/* Status Filter Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'OPEN'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setStatusFilter('CLOSED')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'CLOSED'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Closed
            </button>
            <button
              onClick={() => setStatusFilter('BOTH')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'BOTH'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Both
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No conversations yet
              </p>
            </div>
          ) : (
            <>
              {conversations.map((conv) => (
                <ConversationListItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedConversationId === conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                />
              ))}

              {/* Load More Button */}
              {hasNextPage && (
                <div className="p-4">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Message Thread */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <MessageThread conversationId={selectedConversationId} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg text-gray-500 dark:text-gray-400">
                Select a conversation to view messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Conversation List Item Component
function ConversationListItem({ conversation, isSelected, onClick }) {
  const { contact, lastMessage, lastMessageAt, messageCount, status } = conversation;

  const formatTimestamp = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString();
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-600'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
          <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Status Indicator Dot */}
              {status === 'OPEN' ? (
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Open" />
              ) : status === 'CLOSED' ? (
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Closed" />
              ) : null}

              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {contact.name || contact.phoneNumber}
              </h3>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
              {formatTimestamp(lastMessageAt)}
            </span>
          </div>

          {!contact.name && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
              <Phone className="w-3 h-3 mr-1" />
              {contact.phoneNumber}
            </div>
          )}

          {lastMessage && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {lastMessage.direction === 'OUTBOUND' && 'You: '}
              {lastMessage.body}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Thread Component
function MessageThread({ conversationId }) {
  const [messageText, setMessageText] = useState('');
  const [recentlySentMessage, setRecentlySentMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Fetch conversation with messages
  // Use aggressive polling when we recently sent a message (fallback for WebSocket timing)
  const { data: conversationData, isLoading } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/conversations/${conversationId}`);
      return response.data.data.conversation;
    },
    enabled: !!conversationId,
    refetchInterval: recentlySentMessage ? 2000 : 60000, // Poll every 2s after send, then 60s
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Stop aggressive polling after 30 seconds
  useEffect(() => {
    if (recentlySentMessage) {
      console.log('[MessageThread] Starting aggressive polling after message send');
      const timer = setTimeout(() => {
        console.log('[MessageThread] Stopping aggressive polling');
        setRecentlySentMessage(false);
      }, 30000); // Stop after 30 seconds
      return () => clearTimeout(timer);
    }
  }, [recentlySentMessage]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (body) => {
      await api.post(`/api/v1/conversations/${conversationId}/messages`, { body });
    },
    onSuccess: () => {
      console.log('[MessageThread] Message sent, enabling aggressive polling for status updates');
      setRecentlySentMessage(true); // Start aggressive polling
      queryClient.invalidateQueries(['conversation', conversationId]);
      queryClient.invalidateQueries(['conversations']);
      setMessageText('');
    },
  });

  // Change conversation status mutation
  const changeStatusMutation = useMutation({
    mutationFn: async (newStatus) => {
      await api.patch(`/api/v1/conversations/${conversationId}/status`, { status: newStatus });
    },
    onSuccess: () => {
      console.log('[MessageThread] Conversation status updated');
      queryClient.invalidateQueries(['conversation', conversationId]);
      queryClient.invalidateQueries(['conversations']);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationData?.messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessageMutation.mutate(messageText);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          Loading messages...
        </div>
      </div>
    );
  }

  if (!conversationData) {
    return null;
  }

  const { contact, channel, messages, status } = conversationData;

  return (
    <div className="flex-1 flex flex-col">
      {/* Thread Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {contact.name || contact.phoneNumber}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Phone className="w-4 h-4" />
                <span>{contact.phoneNumber}</span>
                <span>•</span>
                <span>Channel: {channel.identifier}</span>
              </div>
            </div>
          </div>

          {/* Status Change Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeStatusMutation.mutate('OPEN')}
              disabled={status === 'OPEN' || changeStatusMutation.isPending}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                status === 'OPEN'
                  ? 'bg-green-500 text-white cursor-default'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-700 dark:hover:text-green-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {status === 'OPEN' ? 'Open' : 'Mark Open'}
            </button>
            <button
              onClick={() => changeStatusMutation.mutate('CLOSED')}
              disabled={status === 'CLOSED' || changeStatusMutation.isPending}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                status === 'CLOSED'
                  ? 'bg-red-500 text-white cursor-default'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <XOctagon className="w-4 h-4" />
              {status === 'CLOSED' ? 'Closed' : 'Mark Closed'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} contact={contact} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            disabled={sendMessageMutation.isPending}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message, contact }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const menuRef = useRef(null);
  const isInbound = message.direction === 'INBOUND';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = () => {
    if (isInbound) return null;

    const status = message.status;
    const providerStatus = message.smsMessage?.providerStatus;

    if (status === 'FAILED' || providerStatus === 'failed' || providerStatus === 'undelivered') {
      return <XCircle className="w-3 h-3 text-red-500" title="Failed" />;
    }

    if (providerStatus === 'delivered') {
      return <CheckCheck className="w-3 h-3 text-green-500" title="Delivered" />;
    }

    if (providerStatus === 'sent') {
      return <Check className="w-3 h-3 text-gray-500" title="Sent" />;
    }

    if (providerStatus === 'sending' || providerStatus === 'queued') {
      return <Clock className="w-3 h-3 text-gray-400" title="Sending" />;
    }

    return <Check className="w-3 h-3 text-gray-400" title="Sent" />;
  };

  const getStatusText = () => {
    if (isInbound) return null;

    const providerStatus = message.smsMessage?.providerStatus;

    if (providerStatus === 'delivered') return 'Delivered';
    if (providerStatus === 'sent') return 'Sent';
    if (providerStatus === 'failed' || providerStatus === 'undelivered') return 'Failed';
    if (providerStatus === 'sending' || providerStatus === 'queued') return 'Sending';

    return message.status === 'FAILED' ? 'Failed' : 'Sent';
  };

  return (
    <div className={`flex group ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex items-end gap-2 max-w-xl ${isInbound ? 'flex-row' : 'flex-row-reverse'}`}>
        {isInbound && (
          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>
        )}

        <div className="relative">
          {/* Message Content */}
          <div className="flex items-start gap-2">
            <div
              className={`px-4 py-2 rounded-lg ${
                isInbound
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'bg-primary-600 text-white'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
            </div>

            {/* 3-dot menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <button
                    onClick={() => {
                      setShowDetailsModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded-t-lg"
                  >
                    <Info className="w-4 h-4" />
                    Details
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Implement delete
                      alert('Delete functionality coming soon');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded-b-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timestamp and Status */}
          <div
            className={`flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400 ${
              isInbound ? '' : 'justify-end'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{formatTime(message.createdAt)}</span>
            {!isInbound && (
              <>
                <span className="mx-1">•</span>
                {getStatusIcon()}
                <span className={message.status === 'FAILED' || message.smsMessage?.providerStatus === 'failed' ? 'text-red-500' : ''}>
                  {getStatusText()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <MessageDetailsModal
          message={message}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}

// Message Details Modal Component
function MessageDetailsModal({ message, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Message Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Direction:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {message.direction === 'INBOUND' ? 'Received' : 'Sent'}
            </span>
          </div>

          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{message.status}</span>
          </div>

          {message.smsMessage && (
            <>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Twilio Status:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {message.smsMessage.providerStatus || 'N/A'}
                </span>
              </div>

              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Message SID:</span>
                <span className="ml-2 text-gray-900 dark:text-white text-xs break-all">
                  {message.smsMessage.providerMessageId}
                </span>
              </div>

              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Segments:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {message.smsMessage.segments}
                </span>
              </div>
            </>
          )}

          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Sent At:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {new Date(message.createdAt).toLocaleString()}
            </span>
          </div>

          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Message ID:</span>
            <span className="ml-2 text-gray-900 dark:text-white text-xs break-all">
              {message.id}
            </span>
          </div>

          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Body:</span>
            <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap break-words">
              {message.body}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConversationsPage;
