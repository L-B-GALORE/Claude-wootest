/**
 * Country Selector Component
 *
 * Purpose: Dropdown selector for country/dial code selection
 *
 * Features:
 * - Flag emojis for visual identification
 * - Dial codes displayed
 * - Searchable (browser native)
 * - Reusable across application
 *
 * Props:
 * - value: string - Selected country code (e.g., 'US')
 * - onChange: function - Callback when country changes
 * - className: string - Additional CSS classes (optional)
 * - disabled: boolean - Disable selector (optional)
 */

/**
 * Supported countries with flags and dial codes
 *
 * Add more countries as needed
 * Format: { code: ISO 3166-1 alpha-2, dialCode: E.164 prefix, name: English name, flag: emoji }
 */
export const COUNTRIES = [
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', dialCode: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'MX', dialCode: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: 'BR', dialCode: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AR', dialCode: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', dialCode: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', dialCode: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', dialCode: '+51', name: 'Peru', flag: '🇵🇪' },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', dialCode: '+33', name: 'France', flag: '🇫🇷' },
  { code: 'ES', dialCode: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', dialCode: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: 'NL', dialCode: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', dialCode: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', dialCode: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'AT', dialCode: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: 'SE', dialCode: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', dialCode: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', dialCode: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', dialCode: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: 'PL', dialCode: '+48', name: 'Poland', flag: '🇵🇱' },
  { code: 'IE', dialCode: '+353', name: 'Ireland', flag: '🇮🇪' },
  { code: 'PT', dialCode: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: 'GR', dialCode: '+30', name: 'Greece', flag: '🇬🇷' },
  { code: 'CZ', dialCode: '+420', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'HU', dialCode: '+36', name: 'Hungary', flag: '🇭🇺' },
  { code: 'RO', dialCode: '+40', name: 'Romania', flag: '🇷🇴' },
  { code: 'BG', dialCode: '+359', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'IL', dialCode: '+972', name: 'Israel', flag: '🇮🇱' },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SA', dialCode: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'ZA', dialCode: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', dialCode: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: 'EG', dialCode: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: 'SG', dialCode: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: 'MY', dialCode: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'TH', dialCode: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: 'ID', dialCode: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'PH', dialCode: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: 'VN', dialCode: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'JP', dialCode: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', dialCode: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: 'CN', dialCode: '+86', name: 'China', flag: '🇨🇳' },
  { code: 'HK', dialCode: '+852', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'TW', dialCode: '+886', name: 'Taiwan', flag: '🇹🇼' },
];

/**
 * Get country by code
 * @param {string} code - ISO 3166-1 alpha-2 country code
 * @returns {object|undefined} - Country object or undefined
 */
export function getCountryByCode(code) {
  return COUNTRIES.find((country) => country.code === code);
}

/**
 * Get country by dial code
 * @param {string} dialCode - Dial code with + (e.g., '+1')
 * @returns {object|undefined} - First matching country object or undefined
 */
export function getCountryByDialCode(dialCode) {
  return COUNTRIES.find((country) => country.dialCode === dialCode);
}

function CountrySelector({ value, onChange, className = '', disabled = false }) {
  const selectedCountry = getCountryByCode(value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${className} focus:outline-none focus:ring-2 focus:ring-purple-500`}
    >
      {COUNTRIES.map((country) => (
        <option key={country.code} value={country.code}>
          {country.flag} {country.dialCode} {country.name}
        </option>
      ))}
    </select>
  );
}

export default CountrySelector;
