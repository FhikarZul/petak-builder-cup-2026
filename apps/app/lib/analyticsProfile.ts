export type RuntimePlatform = 'android' | 'ios';

// Where the money is, read from the CLOCK.
//
// The MAP moved to @petak/config on 6 Sep 2026 and this now re-exports it, so
// the app and the server read the same one. That was not tidying: while the
// map lived only here, the server healed an account's currency to whatever the
// CLIENT sent, so an app build older than the map kept writing USD over the
// right answer on every open. The server derives it from the timezone now
// (access/users.ts) and this side agrees with it by construction.
import { homeCurrencyForTimezone } from '@petak/config/currency';
export { homeCurrencyForTimezone };

export function homeCurrencyForLocale(locale: string | undefined): string {
  const region = locale?.split(/[-_]/).pop()?.toUpperCase();
  const byRegion: Record<string, string> = {
    SG: 'SGD',
    US: 'USD',
    GB: 'GBP',
    AU: 'AUD',
    CA: 'CAD',
    NZ: 'NZD',
    IE: 'EUR',
  };
  return (region && byRegion[region]) || 'USD';
}

export function buildBootstrapPayload(input: {
  timezone: string | undefined;
  locale: string | undefined;
  platform: RuntimePlatform;
  appVersion: string;
}): {
  anchored_timezone: string;
  home_currency: string;
  platform: RuntimePlatform;
  app_version: string;
} {
  return {
    anchored_timezone: input.timezone || 'UTC',
    // The clock beats the keyboard; the keyboard beats nothing.
    home_currency: homeCurrencyForTimezone(input.timezone) ?? homeCurrencyForLocale(input.locale),
    platform: input.platform,
    app_version: input.appVersion,
  };
}
