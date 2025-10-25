/**
 * Providers Settings Page
 *
 * Purpose: Manage communication providers (Twilio, Gmail, etc.)
 */

import { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import ConnectTwilioModal from '../../components/modals/ConnectTwilioModal';
import ImportNumbersModal from '../../components/modals/ImportNumbersModal';
import SettingsLayout from './SettingsLayout';
import api from '../../services/api';

function ProvidersPageContent() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);

  console.log('[ProvidersPage] Component rendered', { providersCount: providers.length, loading });

  useEffect(() => {
    console.log('[ProvidersPage] useEffect FIRED - calling fetchProviders');
    fetchProviders();

    return () => {
      console.log('[ProvidersPage] Component UNMOUNTING');
    };
  }, []);

  const fetchProviders = async () => {
    console.log('[ProvidersPage] fetchProviders STARTED');
    setLoading(true);
    try {
      const response = await api.get('/api/v1/providers');
      console.log('[ProvidersPage] API response received:', response.data);
      if (response.data.success) {
        setProviders(response.data.data.providers);
        console.log('[ProvidersPage] Providers state SET:', response.data.data.providers);
      }
    } catch (error) {
      console.error('[ProvidersPage] Failed to fetch providers:', error);
    } finally {
      setLoading(false);
      console.log('[ProvidersPage] fetchProviders COMPLETED');
    }
  };

  const handleTwilioConnected = () => {
    fetchProviders();
  };

  const handleNumbersImported = () => {
    setShowImportModal(false);
    fetchProviders();
  };

  const handleOpenImport = (provider) => {
    setSelectedProvider(provider);
    setShowImportModal(true);
  };

  const twilioProvider = providers.find((p) => p.type === 'TWILIO');

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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Providers</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connect your communication providers to start receiving messages and calls
        </p>
      </div>

      <div className="space-y-3">
        {/* Twilio Provider */}
        {(() => {
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

        {/* Gmail Provider (Coming Soon) */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Gmail</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Email support (coming soon)
              </p>
            </div>
          </div>
        </div>
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
    </div>
  );
}

function ProvidersPage() {
  return (
    <SettingsLayout>
      <ProvidersPageContent />
    </SettingsLayout>
  );
}

export default ProvidersPage;
