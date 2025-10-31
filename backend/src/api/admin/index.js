/**
 * Admin Routes
 *
 * Purpose: Admin-only endpoints for WooPhone product monitoring
 *
 * Routes:
 * - GET /admin/overview - Get overview of all companies/users/stats
 *
 * Security:
 * - All routes require authentication
 * - All routes check if user email matches ADMIN_EMAIL env var
 */

import { Hono } from 'hono';
import overviewRoute from './overview.js';

const app = new Hono();

// Mount admin routes
app.route('/overview', overviewRoute);

export default app;
