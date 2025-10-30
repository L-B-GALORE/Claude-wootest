/**
 * Email Verification Page
 *
 * Purpose: Handle email verification from magic link
 *
 * Features:
 * - Extract token from URL query parameter
 * - Call verification API
 * - Auto-login user on success
 * - Handle errors (expired token, invalid token, etc.)
 * - Redirect to dashboard on success
 *
 * URL: /verify-email?token={verificationToken}
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const response = await api.get(`/api/v1/auth/verify-email?token=${token}`);

        const { user, company, tokens } = response.data.data;
        const successMessage = response.data.message;

        // Store tokens
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);

        // Store user and company data
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('company', JSON.stringify(company));

        setStatus('success');
        setMessage(successMessage || 'Email verified! Redirecting to dashboard...');

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          // Force page reload to update auth context
          window.location.href = '/dashboard';
        }, 2000);
      } catch (error) {
        console.error('Email verification error:', error);

        setStatus('error');

        let errorMessage = 'Verification failed';
        let details = null;

        if (error.response?.data?.error) {
          const errorData = error.response.data.error;
          errorMessage = errorData.message || errorMessage;
          details = errorData.details;
        } else if (error.message) {
          errorMessage = error.message;
        }

        setMessage(errorMessage);
        setErrorDetails(details);
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        {status === 'verifying' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Verifying your email...
            </h1>

            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we verify your email address.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Email verified!
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-300">
                You're now logged in and will be redirected to your dashboard.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Verification failed
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>

            {errorDetails?.canResend && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Your verification link has expired.
                </p>
                <Link
                  to="/resend-verification"
                  className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Request a new verification email
                </Link>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <Link
                to="/login"
                className="block text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Go to login
              </Link>
              <Link
                to="/register"
                className="block text-gray-600 dark:text-gray-400 hover:underline"
              >
                Create a new account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmailPage;
