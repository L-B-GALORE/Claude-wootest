/**
 * Frontend Entry Point
 *
 * Purpose: Initialize React application with all providers
 *
 * Provider Order (important!):
 * 1. BrowserRouter - Routing
 * 2. ThemeProvider - Light/dark mode
 * 3. AuthProvider - Authentication state
 * 4. QueryClientProvider - React Query for data fetching
 *
 * BEFORE MODIFYING:
 * - Will this change affect app initialization?
 * - Are the providers in the correct order?
 * - Will this break existing provider dependencies?
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
