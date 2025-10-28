/**
 * Phone Number Normalization Utility
 *
 * Purpose: Normalize phone numbers to E.164 format for consistent storage and lookup
 *
 * Features:
 * - Convert any phone number format to E.164 (+15551234567)
 * - Validate phone numbers
 * - Handle international numbers
 *
 * CRITICAL: Always normalize phone numbers before:
 * - Storing in database
 * - Searching in database
 * - Comparing phone numbers
 *
 * E.164 Format: +[country code][number]
 * Example: +15551234567 (US), +442071234567 (UK), +919876543210 (India)
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Normalize phone number to E.164 format
 *
 * @param {string} phoneNumber - Phone number in any format
 * @param {string} defaultCountry - ISO 3166-1 alpha-2 country code (default: 'US')
 * @returns {string|null} - Normalized E.164 phone number or null if invalid
 *
 * Examples:
 *   normalizePhoneNumber('(555) 123-4567', 'US') // '+15551234567'
 *   normalizePhoneNumber('555-123-4567', 'US')   // '+15551234567'
 *   normalizePhoneNumber('+1 555 123 4567')      // '+15551234567'
 *   normalizePhoneNumber('+44 20 7123 4567', 'GB') // '+442071234567'
 *   normalizePhoneNumber('invalid')              // null
 */
export function normalizePhoneNumber(phoneNumber, defaultCountry = 'US') {
  if (!phoneNumber) return null;

  try {
    // Parse phone number with default country
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry);

    // Validate
    if (!parsed || !parsed.isValid()) {
      console.warn('[Phone Normalization] Invalid phone number:', phoneNumber);
      return null;
    }

    // Return E.164 format
    return parsed.number;
  } catch (error) {
    console.error('[Phone Normalization] Error parsing phone number:', phoneNumber, error);
    return null;
  }
}

/**
 * Validate phone number
 *
 * @param {string} phoneNumber - Phone number in any format
 * @param {string} defaultCountry - ISO 3166-1 alpha-2 country code (default: 'US')
 * @returns {boolean} - True if valid, false otherwise
 *
 * Examples:
 *   validatePhoneNumber('(555) 123-4567', 'US') // true
 *   validatePhoneNumber('555', 'US')             // false
 *   validatePhoneNumber('+44 20 7123 4567')     // true
 */
export function validatePhoneNumber(phoneNumber, defaultCountry = 'US') {
  if (!phoneNumber) return false;

  try {
    return isValidPhoneNumber(phoneNumber, defaultCountry);
  } catch (error) {
    return false;
  }
}

/**
 * Get phone number details
 *
 * @param {string} phoneNumber - Phone number in any format
 * @param {string} defaultCountry - ISO 3166-1 alpha-2 country code (default: 'US')
 * @returns {object|null} - Phone number details or null if invalid
 *
 * Returns:
 *   {
 *     e164: '+15551234567',
 *     country: 'US',
 *     nationalFormat: '(555) 123-4567',
 *     internationalFormat: '+1 555 123 4567',
 *     isValid: true
 *   }
 */
export function getPhoneNumberDetails(phoneNumber, defaultCountry = 'US') {
  if (!phoneNumber) return null;

  try {
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry);

    if (!parsed || !parsed.isValid()) {
      return null;
    }

    return {
      e164: parsed.number,
      country: parsed.country,
      nationalFormat: parsed.formatNational(),
      internationalFormat: parsed.formatInternational(),
      isValid: true,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Batch normalize phone numbers
 *
 * @param {string[]} phoneNumbers - Array of phone numbers
 * @param {string} defaultCountry - ISO 3166-1 alpha-2 country code (default: 'US')
 * @returns {string[]} - Array of normalized E.164 phone numbers (skips invalid)
 *
 * Example:
 *   batchNormalizePhoneNumbers(['555-1234', '(555) 123-4567'], 'US')
 *   // ['+15551234567']
 */
export function batchNormalizePhoneNumbers(phoneNumbers, defaultCountry = 'US') {
  if (!Array.isArray(phoneNumbers)) return [];

  return phoneNumbers
    .map(phoneNumber => normalizePhoneNumber(phoneNumber, defaultCountry))
    .filter(Boolean); // Remove nulls
}
