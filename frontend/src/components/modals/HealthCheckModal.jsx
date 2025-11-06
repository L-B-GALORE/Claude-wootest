/**
 * Health Check Modal
 *
 * Purpose: Display Twilio provider health check results and allow auto-fix
 */

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, XCircle, Loader, RefreshCw } from 'lucide-react';
import api from '../../services/api';

export default function HealthCheckModal({ isOpen, onClose, provider, onFixed }) {
  const [checking, setChecking] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [healthResults, setHealthResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && provider) {
      runHealthCheck();
    }
  }, [isOpen, provider]);

  const runHealthCheck = async () => {
    setChecking(true);
    setError(null);
    setHealthResults(null);

    try {
      const response = await api.get(`/api/v1/providers/${provider.id}/health`);
      if (response.data.success) {
        setHealthResults(response.data.data);
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setError(err.response?.data?.error?.message || 'Failed to run health check');
    } finally {
      setChecking(false);
    }
  };

  const handleAutoFix = async () => {
    setFixing(true);
    setError(null);

    try {
      const response = await api.post(`/api/v1/providers/${provider.id}/fix`);
      if (response.data.success) {
        // Run health check again to show updated status
        await runHealthCheck();

        // Notify parent if any fixes were made
        if (Object.keys(response.data.data.fixed).length > 0) {
          onFixed?.();
        }
      }
    } catch (err) {
      console.error('Auto-fix failed:', err);
      setError(err.response?.data?.error?.message || 'Failed to auto-fix issues');
    } finally {
      setFixing(false);
    }
  };

  if (!isOpen) return null;

  const renderStatusIcon = (status) => {
    if (status === 'pass') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (status === 'fail') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const renderOverallStatus = () => {
    if (!healthResults) return null;

    const { overall } = healthResults;

    if (overall === 'healthy') {
      return (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Provider is healthy
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                All components are configured correctly
              </p>
            </div>
          </div>
        </div>
      );
    } else if (overall === 'degraded') {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Configuration issues detected
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                {healthResults.summary.failed} out of {healthResults.summary.total} checks failed
              </p>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Critical issues detected
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Provider integration is not functional
              </p>
            </div>
          </div>
        </div>
      );
    }
  };

  const renderCheckDetails = () => {
    if (!healthResults?.checks) return null;

    const { checks } = healthResults;

    return (
      <div className="space-y-4">
        {/* Credentials */}
        {checks.credentials && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {renderStatusIcon(checks.credentials.status)}
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Account Credentials
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {checks.credentials.message}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TwiML App */}
        {checks.twimlApp && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {renderStatusIcon(checks.twimlApp.status)}
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    TwiML Application
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {checks.twimlApp.message}
                  </p>
                  {checks.twimlApp.issues && checks.twimlApp.issues.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {checks.twimlApp.issues.map((issue, idx) => (
                        <li key={idx} className="text-xs text-red-600 dark:text-red-400">
                          • {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {checks.twimlApp.canAutoFix && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
                      ✓ Can be fixed automatically
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Key */}
        {checks.apiKey && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {renderStatusIcon(checks.apiKey.status)}
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    API Key
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {checks.apiKey.message}
                  </p>
                  {checks.apiKey.canAutoFix && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
                      ✓ Can be fixed automatically
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phone Numbers */}
        {checks.phoneNumbers && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {renderStatusIcon(checks.phoneNumbers.status)}
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Phone Numbers
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {checks.phoneNumbers.message}
                  </p>
                  {checks.phoneNumbers.details && checks.phoneNumbers.details.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {checks.phoneNumbers.details.map((detail, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">
                            {detail.phoneNumber}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {detail.issues.map((issue, issueIdx) => (
                              <li key={issueIdx} className="text-xs text-red-600 dark:text-red-400">
                                • {issue.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {checks.phoneNumbers.canAutoFix && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
                      ✓ Can be fixed automatically
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Provider Health Check
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {provider?.type} integration diagnostics
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {checking ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-8 h-8 text-primary-600 animate-spin mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Running health check...
              </p>
            </div>
          ) : healthResults ? (
            <div className="space-y-6">
              {renderOverallStatus()}
              {renderCheckDetails()}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={runHealthCheck}
            disabled={checking || fixing}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>Re-check</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
            {healthResults?.summary?.canAutoFix && healthResults?.overall !== 'healthy' && (
              <button
                onClick={handleAutoFix}
                disabled={fixing}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fixing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Fixing...</span>
                  </>
                ) : (
                  <span>Fix All Issues</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
