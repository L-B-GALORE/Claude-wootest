/**
 * Company Settings API Router
 * Phase 1: Contact system with phone normalization
 *
 * Purpose: Manage company-level settings
 *
 * Routes:
 * - GET /company/settings - Get all company settings
 * - GET /company/settings/:key - Get specific setting
 * - PUT /company/settings/:key - Update specific setting
 * - PUT /company/settings/dialing - Update dialing preferences (country code)
 *
 * Settings Keys:
 * - 'default_country_code' - Default country code for dialer
 * - 'force_cell_ringing' - Force all users to have cell phone ring
 * - 'business_hours' - Business hours configuration
 *
 * BEFORE MODIFYING:
 * - Are permissions properly checked? (only OWNER/ADMIN can modify)
 * - Do settings have proper validation?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

/**
 * Get all company settings
 * GET /company/settings
 */
app.get('/settings', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const settings = await prisma.companySetting.findMany({
      where: {
        companyId,
      },
      select: {
        key: true,
        value: true,
        updatedAt: true,
      },
    });

    // Convert array to object for easier access
    const settingsMap = {};
    settings.forEach((setting) => {
      settingsMap[setting.key] = setting.value;
    });

    return c.json({
      success: true,
      data: {
        settings: settingsMap,
      },
    });
  } catch (error) {
    console.error('Failed to fetch company settings:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch company settings',
        },
      },
      500
    );
  }
});

/**
 * Get specific company setting
 * GET /company/settings/:key
 */
app.get('/settings/:key', async (c) => {
  try {
    const companyId = c.get('companyId');
    const { key } = c.req.param();
    const prisma = getPrisma(c.env.DATABASE_URL);

    const setting = await prisma.companySetting.findUnique({
      where: {
        companyId_key: {
          companyId,
          key,
        },
      },
    });

    if (!setting) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Setting '${key}' not found`,
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        key: setting.key,
        value: setting.value,
        updatedAt: setting.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to fetch company setting:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch company setting',
        },
      },
      500
    );
  }
});

/**
 * Update specific company setting
 * PUT /company/settings/:key
 *
 * Body: { value: any }
 */
app.put('/settings/:key', async (c) => {
  try {
    const companyId = c.get('companyId');
    const { key } = c.req.param();
    const { value } = await c.req.json();
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Validate that value is provided
    if (value === undefined) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Setting value is required',
          },
        },
        400
      );
    }

    // Upsert setting (create if not exists, update if exists)
    const setting = await prisma.companySetting.upsert({
      where: {
        companyId_key: {
          companyId,
          key,
        },
      },
      update: {
        value,
      },
      create: {
        companyId,
        key,
        value,
      },
    });

    console.log(`[Company Settings] Updated ${key} for company ${companyId}`);

    return c.json({
      success: true,
      data: {
        key: setting.key,
        value: setting.value,
        updatedAt: setting.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update company setting:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update company setting',
        },
      },
      500
    );
  }
});

/**
 * Update dialing preferences (convenience endpoint)
 * PUT /company/settings/dialing
 *
 * Body: {
 *   countryCode: 'US',  // ISO 3166-1 alpha-2
 *   dialCode: '+1',
 *   countryName: 'United States'
 * }
 */
app.put('/settings/dialing', async (c) => {
  try {
    const companyId = c.get('companyId');
    const body = await c.req.json();
    const prisma = getPrisma(c.env.DATABASE_URL);

    const { countryCode, dialCode, countryName } = body;

    // Validate input
    if (!countryCode || !dialCode || !countryName) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'countryCode, dialCode, and countryName are required',
          },
        },
        400
      );
    }

    // Validate country code format (2 letters)
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_COUNTRY_CODE',
            message: 'Country code must be 2 uppercase letters (e.g., US, GB, AU)',
          },
        },
        400
      );
    }

    // Store as JSON
    const value = {
      code: countryCode,
      dialCode,
      name: countryName,
    };

    // Upsert setting
    const setting = await prisma.companySetting.upsert({
      where: {
        companyId_key: {
          companyId,
          key: 'default_country_code',
        },
      },
      update: {
        value,
      },
      create: {
        companyId,
        key: 'default_country_code',
        value,
      },
    });

    console.log(`[Company Settings] Updated default country code to ${countryCode} for company ${companyId}`);

    return c.json({
      success: true,
      data: {
        countryCode: setting.value.code,
        dialCode: setting.value.dialCode,
        countryName: setting.value.name,
      },
    });
  } catch (error) {
    console.error('Failed to update dialing preferences:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update dialing preferences',
        },
      },
      500
    );
  }
});

export default app;
