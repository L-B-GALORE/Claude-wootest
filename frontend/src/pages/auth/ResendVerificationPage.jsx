/**
 * Resend Verification Email Page
 *
 * Purpose: Allow users to request a new verification email
 *
 * Features:
 * - Email input form
 * - Call resend verification API
 * - Show success/error messages
 * - Link back to login
 *
 * Used when:
 * - User didn't receive original email
 * - Verification token expired
 * - User accidentally deleted email
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await api.post('/api/v1/auth/resend-verification', { email });

      const { message: successMessage, data } = response.data;

      setSuccess(true);
      setMessage(successMessage || 'Verification email sent! Check your inbox.');
    } catch (err) {
      console.error('Resend verification error:', err);

      let errorMessage = 'Failed to send verification email';

      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        {success ? (
          // Success state
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Email sent!
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                We sent a new verification link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">
                Check your inbox and click the link to verify your account.
              </p>
            </div>

            <div className="space-y-3">
              <Link
                to="/login"
                className="block text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          // Resend form
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Resend verification email
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Enter your email to receive a new verification link
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Sending...' : 'Send verification email'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Remember your password?{' '}
                <Link
                  to="/login"
                  className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  Back to login
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ResendVerificationPage;
