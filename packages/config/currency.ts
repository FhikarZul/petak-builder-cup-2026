// Client hint for display and initial profile setup. The API remains authoritative.
export const CURRENCY_BY_TIMEZONE: Record<string, string> = {
  'Asia/Singapore': 'SGD',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Jakarta': 'IDR',
  'Asia/Makassar': 'IDR',
  'Asia/Jayapura': 'IDR',
  'Asia/Bangkok': 'THB',
  'Asia/Manila': 'PHP',
  'Asia/Ho_Chi_Minh': 'VND',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Taipei': 'TWD',
  'Asia/Shanghai': 'CNY',
  'Asia/Tokyo': 'JPY',
  'Asia/Seoul': 'KRW',
  'Asia/Kolkata': 'INR',
  'Asia/Dubai': 'AED',
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Perth': 'AUD',
  'Australia/Adelaide': 'AUD',
  'Pacific/Auckland': 'NZD',
  'Europe/London': 'GBP',
  'Europe/Dublin': 'EUR',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
};

export function homeCurrencyForTimezone(timezone: string | undefined | null): string | null {
  return (timezone && CURRENCY_BY_TIMEZONE[timezone]) || null;
}
