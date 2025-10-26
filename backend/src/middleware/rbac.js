/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Purpose: Enforce role-based permissions on routes.
 *
 * Roles (from highest to lowest privilege):
 * - OWNER: Full access (billing, delete company, manage all)
 * - ADMIN: Manage users, settings, inboxes (no billing)
 * - AGENT: Handle conversations, make calls (limited admin)
 *
 * Permission Examples:
 * - Only OWNER can delete company
 * - OWNER + ADMIN can invite users
 * - OWNER + ADMIN can create inboxes
 * - All roles can view conversations assigned to them
 *
 * Future: Granular permissions (e.g., 'inboxes.create', 'users.invite')
 * For now, we use role-based checks with hooks for future expansion.
 *
 * BEFORE MODIFYING:
 * - Will this change lock out existing users?
 * - Do we need a permission migration?
 * - Should this check be in database or code?
 *
 * Used by:
 * - Protected admin routes
 * - User management endpoints
 * - Company settings endpoints
 */

import { APIError } from './error-handler.js';

/**
 * Require specific roles to access endpoint
 * @param {string[]} allowedRoles - Array of allowed roles
 */
export function requireRole(...allowedRoles) {
  return async (c, next) => {
    const userRole = c.get('userRole');

    if (!userRole) {
      throw new APIError(
        'UNAUTHORIZED',
        'Authentication required',
        401
      );
    }

    if (!allowedRoles.includes(userRole)) {
      throw new APIError(
        'FORBIDDEN',
        `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        403,
        { userRole, requiredRoles: allowedRoles }
      );
    }

    await next();
  };
}

/**
 * Require owner role
 */
export const requireOwner = requireRole('OWNER');

/**
 * Require owner or admin role
 */
export const requireAdmin = requireRole('OWNER', 'ADMIN');

/**
 * Check if user has permission (future: granular permissions)
 * For now, maps permissions to roles
 */
export function requirePermission(permission) {
  return async (c, next) => {
    const userRole = c.get('userRole');

    // Permission to role mapping (will be database-driven later)
    const permissionRoleMap = {
      'users.invite': ['OWNER', 'ADMIN'],
      'users.delete': ['OWNER', 'ADMIN'],
      'inboxes.create': ['OWNER', 'ADMIN'],
      'inboxes.edit': ['OWNER', 'ADMIN'],
      'inboxes.delete': ['OWNER', 'ADMIN'],
      'company.settings': ['OWNER', 'ADMIN'],
      'company.delete': ['OWNER'],
      'conversations.view': ['OWNER', 'ADMIN', 'AGENT'],
      'conversations.assign': ['OWNER', 'ADMIN'],
      'messages.send': ['OWNER', 'ADMIN', 'AGENT'],
    };

    const allowedRoles = permissionRoleMap[permission] || [];

    if (!allowedRoles.includes(userRole)) {
      throw new APIError(
        'FORBIDDEN',
        `Insufficient permissions for: ${permission}`,
        403,
        { userRole, permission }
      );
    }

    await next();
  };
}
