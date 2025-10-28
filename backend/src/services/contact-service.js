/**
 * Contact Service
 *
 * Purpose: Manage contacts (find, create, update, merge)
 *
 * Features:
 * - Find or create contact by phone/email/WhatsApp/Facebook
 * - Prevent duplicate contacts per company
 * - Automatic contact creation during calls/messages
 * - Phone number normalization before storage/lookup
 *
 * CRITICAL:
 * - Always use normalized phone numbers (E.164 format)
 * - Check all identifiers when searching (phone, email, WhatsApp, Facebook)
 * - Respect company isolation (different companies can have same contact)
 */

import { normalizePhoneNumber } from '../utils/phone-normalization.js';
import { getPrismaClient } from '../utils/prisma.js';

/**
 * Find or create contact
 *
 * Searches for existing contact by any identifier (phone, email, WhatsApp, Facebook).
 * If not found, creates new contact.
 *
 * @param {string} companyId - Company ID
 * @param {object} identifiers - Contact identifiers
 * @param {string} identifiers.phoneNumber - Phone number (will be normalized)
 * @param {string} identifiers.email - Email address
 * @param {string} identifiers.whatsappId - WhatsApp ID (will be normalized)
 * @param {string} identifiers.facebookId - Facebook Page-Scoped ID
 * @param {string} identifiers.name - Contact name (optional)
 * @param {string} defaultCountry - Default country for phone normalization (default: 'US')
 * @returns {Promise<Contact>} - Contact object
 *
 * Example:
 *   const contact = await findOrCreateContact('company-123', {
 *     phoneNumber: '(555) 123-4567',
 *     name: 'John Doe'
 *   });
 *   // Returns: { id: 'contact-456', phoneNumber: '+15551234567', name: 'John Doe', ... }
 */
export async function findOrCreateContact(companyId, identifiers, defaultCountry = 'US') {
  const prisma = getPrismaClient();

  // Normalize phone numbers before processing
  const normalizedPhone = identifiers.phoneNumber
    ? normalizePhoneNumber(identifiers.phoneNumber, defaultCountry)
    : null;

  const normalizedWhatsApp = identifiers.whatsappId
    ? normalizePhoneNumber(identifiers.whatsappId, defaultCountry)
    : null;

  // Build search conditions (check all identifiers)
  const searchConditions = [];

  if (normalizedPhone) {
    searchConditions.push({ phoneNumber: normalizedPhone });
  }

  if (identifiers.email) {
    searchConditions.push({ email: identifiers.email.toLowerCase().trim() });
  }

  if (normalizedWhatsApp) {
    searchConditions.push({ whatsappId: normalizedWhatsApp });
  }

  if (identifiers.facebookId) {
    searchConditions.push({ facebookId: identifiers.facebookId });
  }

  // If no valid identifiers provided, throw error
  if (searchConditions.length === 0) {
    throw new Error('At least one identifier (phone, email, WhatsApp, or Facebook ID) is required');
  }

  console.log('[Contact Service] Finding or creating contact for company:', companyId, {
    phoneNumber: normalizedPhone,
    email: identifiers.email,
    whatsappId: normalizedWhatsApp,
    facebookId: identifiers.facebookId,
  });

  try {
    // Try to find existing contact
    let contact = await prisma.contact.findFirst({
      where: {
        companyId,
        OR: searchConditions,
      },
    });

    if (contact) {
      console.log('[Contact Service] Found existing contact:', contact.id);
      return contact;
    }

    // Contact not found - create new one
    console.log('[Contact Service] Creating new contact');

    // Determine name: use provided name, or fallback to phone/email
    const name = identifiers.name ||
      normalizedPhone ||
      identifiers.email ||
      normalizedWhatsApp ||
      'Unknown';

    contact = await prisma.contact.create({
      data: {
        companyId,
        phoneNumber: normalizedPhone,
        email: identifiers.email ? identifiers.email.toLowerCase().trim() : null,
        whatsappId: normalizedWhatsApp,
        facebookId: identifiers.facebookId,
        name,
      },
    });

    console.log('[Contact Service] Created new contact:', contact.id);
    return contact;
  } catch (error) {
    // Handle unique constraint violations gracefully
    if (error.code === 'P2002') {
      console.warn('[Contact Service] Unique constraint violation, retrying find...');

      // Another request created the contact between our find and create
      // Try finding again
      const contact = await prisma.contact.findFirst({
        where: {
          companyId,
          OR: searchConditions,
        },
      });

      if (contact) {
        return contact;
      }
    }

    console.error('[Contact Service] Error finding or creating contact:', error);
    throw error;
  }
}

/**
 * Find contact by ID
 *
 * @param {string} companyId - Company ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<Contact|null>} - Contact or null if not found
 */
export async function findContactById(companyId, contactId) {
  const prisma = getPrismaClient();

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId, // Ensure company isolation
    },
  });

  return contact;
}

/**
 * Update contact
 *
 * @param {string} companyId - Company ID
 * @param {string} contactId - Contact ID
 * @param {object} updates - Fields to update
 * @returns {Promise<Contact>} - Updated contact
 */
export async function updateContact(companyId, contactId, updates) {
  const prisma = getPrismaClient();

  // Normalize phone numbers if provided
  if (updates.phoneNumber) {
    updates.phoneNumber = normalizePhoneNumber(updates.phoneNumber) || updates.phoneNumber;
  }

  if (updates.whatsappId) {
    updates.whatsappId = normalizePhoneNumber(updates.whatsappId) || updates.whatsappId;
  }

  if (updates.email) {
    updates.email = updates.email.toLowerCase().trim();
  }

  const contact = await prisma.contact.update({
    where: {
      id: contactId,
      companyId, // Ensure company isolation
    },
    data: updates,
  });

  console.log('[Contact Service] Updated contact:', contactId);
  return contact;
}

/**
 * List contacts for company
 *
 * @param {string} companyId - Company ID
 * @param {object} options - Query options
 * @param {number} options.limit - Max results (default: 50)
 * @param {number} options.offset - Offset for pagination (default: 0)
 * @param {string} options.search - Search query (name, phone, email)
 * @returns {Promise<Contact[]>} - Array of contacts
 */
export async function listContacts(companyId, options = {}) {
  const prisma = getPrismaClient();

  const {
    limit = 50,
    offset = 0,
    search = null,
  } = options;

  const where = {
    companyId,
  };

  // Add search filter if provided
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return contacts;
}

/**
 * Delete contact
 *
 * @param {string} companyId - Company ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<void>}
 */
export async function deleteContact(companyId, contactId) {
  const prisma = getPrismaClient();

  await prisma.contact.delete({
    where: {
      id: contactId,
      companyId, // Ensure company isolation
    },
  });

  console.log('[Contact Service] Deleted contact:', contactId);
}
