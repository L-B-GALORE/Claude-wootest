/**
 * Debug Page for Twilio Integration
 *
 * Shows detailed error messages when token generation fails
 */

import { useState } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

export default function DebugTwilio() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const testTokenGeneration = async () => {
    setTesting(true);
    setResult(null);

    try {
      console.log('[Debug] Calling /api/v1/voice/token...');
      const response = await api.post('/api/v1/voice/token');

      console.log('[Debug] Response:', response);

      if (response.data.success) {
        setResult({
          success: true,
          message: 'Token generated successfully!',
          token: response.data.data.token,
          identity: response.data.data.identity,
        });
      } else {
        setResult({
          success: false,
          message: 'API returned success: false',
          error: response.data.error || 'Unknown error',
        });
      }
    } catch (error) {
      console.error('[Debug] Error:', error);

      setResult({
        success: false,
        message: 'API call failed',
        error: {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          apiError: error.response?.data?.error,
          responseData: error.response?.data,
        },
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Twilio Integration Debug
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This page tests the Twilio voice token generation to show you exactly what's failing.
          </p>

          <button
            onClick={testTokenGeneration}
            disabled={testing}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {testing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>Test Token Generation</span>
              </>
            )}
          </button>

          {result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">
                        ✅ Token Generation Works!
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-400 mb-4">
                        {result.message}
                      </p>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Identity:</span>
                          <p className="text-sm text-gray-900 dark:text-white font-mono">{result.identity}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Token (first 100 chars):</span>
                          <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                            {result.token?.substring(0, 100)}...
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Token Length:</span>
                          <p className="text-sm text-gray-900 dark:text-white font-mono">{result.token?.length} characters</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <strong>Next step:</strong> If this works but calling still fails, the issue is in the Twilio Device
                          initialization on the Dashboard page. Check the browser console for errors.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                        ❌ Token Generation Failed
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                        {result.message}
                      </p>

                      {result.error && (
                        <div className="space-y-3">
                          <div className="bg-white dark:bg-gray-800 rounded p-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Error Details:</h4>
                            <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto">
                              {JSON.stringify(result.error, null, 2)}
                            </pre>
                          </div>

                          {result.error.apiError && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                                API Error Code:
                              </p>
                              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                {result.error.apiError.code}
                              </p>
                              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
                                {result.error.apiError.message}
                              </p>
                            </div>
                          )}

                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                              <strong>What to do:</strong>
                            </p>
                            <ul className="text-sm text-blue-700 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
                              <li>If error is "PROVIDER_NOT_FOUND": Connect Twilio in Settings → Providers</li>
                              <li>If error is "TOKEN_GENERATION_FAILED": Run Health Check and Auto-Fix</li>
                              <li>If error is about invalid credentials: Reconnect Twilio provider</li>
                              <li>Copy the error details above and share them for help</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Browser Console Output
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Open your browser's Developer Console (F12) to see detailed logs of this test.
                  Look for lines starting with [Debug].
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
