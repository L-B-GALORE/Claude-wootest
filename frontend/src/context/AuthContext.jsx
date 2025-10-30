/**
 * Authentication Context
 *
 * Purpose: Manage user authentication state globally
 *
 * Provides:
 * - user: Current user object (or null)
 * - company: Current company object
 * - loading: Is auth state being determined?
 * - login(email, password): Login function
 * - register(data): Registration function
 * - logout(): Logout function
 *
 * BEFORE MODIFYING:
 * - Will this change affect all components using useAuth?
 * - Does this break the token storage logic?
 * - Are we maintaining backward compatibility?
 */

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in on mount
  useEffect(() => {
    const initAuth = () => {
      const token = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');
      const storedCompany = localStorage.getItem('company');

      if (token && storedUser && storedCompany) {
        try {
          setUser(JSON.parse(storedUser));
          setCompany(JSON.parse(storedCompany));
        } catch (error) {
          console.error('Failed to parse stored auth data:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('company');
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/v1/auth/login', {
        email,
        password,
      });

      const { user: userData, company: companyData, tokens } = response.data.data;

      // Store tokens
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      // Store user and company data
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('company', JSON.stringify(companyData));

      setUser(userData);
      setCompany(companyData);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);

      // Handle different error types
      let errorMessage = 'Login failed';

      if (error.code === 'ERR_CANCELED') {
        errorMessage = 'Request was cancelled. Please try again.';
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const register = async (data) => {
    try {
      const response = await api.post('/api/v1/auth/register', data);

      // New flow: Registration returns user data but NO tokens
      // User must verify email first before they can login
      const { user: userData, company: companyData, emailSent } = response.data.data;
      const message = response.data.message;

      return {
        success: true,
        data: {
          user: userData,
          company: companyData,
          emailSent,
        },
        message,
      };
    } catch (error) {
      console.error('Registration error:', error);

      // Handle different error types
      let errorMessage = 'Registration failed';

      if (error.code === 'ERR_CANCELED') {
        errorMessage = 'Request was cancelled. Please try again.';
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    setUser(null);
    setCompany(null);
  };

  const value = {
    user,
    company,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
