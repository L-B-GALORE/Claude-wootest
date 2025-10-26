/**
 * Authentication Routes
 *
 * Purpose: Group all authentication-related endpoints.
 *
 * Routes:
 * - POST /auth/register - Register new company + owner user
 * - POST /auth/login - Login and get tokens
 * - POST /auth/refresh - Refresh access token
 * - POST /auth/logout - Logout (invalidate tokens) - future
 * - POST /auth/forgot-password - Request password reset - future
 * - POST /auth/reset-password - Reset password with token - future
 *
 * All routes are public (no authentication required)
 */

import { Hono } from 'hono';
import registerRoute from './register.js';
import loginRoute from './login.js';
import refreshRoute from './refresh.js';

const app = new Hono();

// Mount auth routes
app.route('/register', registerRoute);
app.route('/login', loginRoute);
app.route('/refresh', refreshRoute);

export default app;
