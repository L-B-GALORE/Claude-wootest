/**
 * Tenant Context Middleware
 *
 * Purpose: Ensure all database queries are scoped to the current company (tenant).
 *
 * Multi-Tenancy Enforcement:
 * - Every authenticated request has c.get('companyId')
 * - All database queries MUST filter by companyId
 * - This middleware provides helper to ensure we never forget
 *
 * Security:
 * - Prevents cross-tenant data leakage
 * - User from Company A cannot access Company B's data
 * - Even if they somehow get another company's resource ID
 *
 * Usage in Route Handlers:
 * ```
 * const companyId = c.get('companyId');
 * const users = await db.user.findMany({
 *   where: { companyId }  // ALWAYS filter by companyId
 * });
 * ```
 *
 * BEFORE MODIFYING:
 * - Will this change affect all database queries?
 * - Are we enforcing tenant isolation consistently?
 * - Should we add a global Prisma middleware for this?
 *
 * Used by:
 * - All authenticated routes
 * - All database query functions
 */

import { APIError } from './error-handler.js';

/**
 * Ensure company context is set
 * This middleware should run after authMiddleware
 */
export async function tenantContextMiddleware(c, next) {
  const companyId = c.get('companyId');

  if (!companyId) {
    throw new APIError(
      'MISSING_TENANT_CONTEXT',
      'Company context not found. This endpoint requires authentication.',
      401
    );
  }

  await next();
}

/**
 * Helper: Get tenant-scoped database filter
 * Use this in all database queries to ensure tenant isolation
 *
 * Example:
 * const where = getTenantFilter(c, { status: 'active' });
 * const users = await db.user.findMany({ where });
 * // Equivalent to: { companyId: '...', status: 'active' }
 */
export function getTenantFilter(c, additionalFilters = {}) {
  const companyId = c.get('companyId');

  if (!companyId) {
    throw new APIError(
      'MISSING_TENANT_CONTEXT',
      'Company context not found',
      500
    );
  }

  return {
    companyId,
    ...additionalFilters,
  };
}

/**
 * Helper: Verify resource belongs to current tenant
 * Use this when fetching a resource by ID to ensure it belongs to the company
 *
 * Example:
 * const inbox = await db.inbox.findUnique({ where: { id: inboxId } });
 * verifyTenantOwnership(c, inbox);
 */
export function verifyTenantOwnership(c, resource) {
  if (!resource) {
    throw new APIError(
      'NOT_FOUND',
      'Resource not found',
      404
    );
  }

  const companyId = c.get('companyId');
  if (resource.companyId !== companyId) {
    throw new APIError(
      'FORBIDDEN',
      'Access denied. Resource belongs to different company.',
      403
    );
  }
}
