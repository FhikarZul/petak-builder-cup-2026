// Click-path back for drawer routes (founder ruling 1 Sep 2026: "back should
// be as per click path"). Drawer routes are SIBLINGS — react-navigation keeps
// no back stack between them, so without this, every back arrow jumped
// straight to chat. We record the visit order ourselves and walk it backwards.
// Module-level on purpose: the Drawer layout records, ScreenHeader consumes,
// and both must share ONE stack without prop plumbing through every screen.

/** Segment path (what useSegments reports under `(drawer)`) → expo-router
 *  href. Unknown names are not drawer screens and never enter the path. */
const HREF: Record<string, string> = {
  board: '/(drawer)/board',
  'dashboards/penny': '/(drawer)/dashboards/penny',
  'dashboards/milo': '/(drawer)/dashboards/milo',
  'dashboards/mira': '/(drawer)/dashboards/mira',
  'wallet/coins': '/(drawer)/wallet/coins',
  'wallet/photo-credits': '/(drawer)/wallet/photo-credits',
  'wallet/referral': '/(drawer)/wallet/referral',
  household: '/(drawer)/household',
  'household/moving-out': '/(drawer)/household/moving-out',
  invite: '/(drawer)/invite',
  settings: '/(drawer)/settings',
  'settings/notifications': '/(drawer)/settings/notifications',
  'settings/your-details': '/(drawer)/settings/your-details',
  'settings/your-rules': '/(drawer)/settings/your-rules',
  'settings/tell-ollie': '/(drawer)/settings/tell-ollie',
  'settings/told-ollie': '/(drawer)/settings/told-ollie',
  'settings/delete': '/(drawer)/settings/delete',
};

const stack: string[] = [];
const MAX_DEPTH = 24;

/** Record a drawer screen becoming visible. `index` (chat) is never recorded:
 *  landing on chat IS the bottom of the path. */
export function recordDrawerVisit(routeName: string): void {
  const href = HREF[routeName];
  if (!href) return;
  if (stack[stack.length - 1] === href) return;
  stack.push(href);
  if (stack.length > MAX_DEPTH) stack.shift();
}

/**
 * The destination a back press should go to: the screen visited before the
 * current one, or null when the path is exhausted (go home to chat).
 * Pops the current screen; the destination stays on the stack so a later
 * back from THAT screen continues walking backwards.
 */
export function drawerBackTarget(): string | null {
  stack.pop(); // leave the current screen
  return stack[stack.length - 1] ?? null;
}

/** The top of the visit stack — the screen currently showing (if it came
 *  through the drawer). */
export function peekDrawerTop(): string | null {
  return stack[stack.length - 1] ?? null;
}

// ---- Drawer-origin back ----------------------------------------------
// Founder ruling (2 Sep 2026): a screen opened FROM the drawer goes back TO
// the drawer — reopened, because that is where the user was. DrawerContent
// marks the origin on every drawer-row navigation; back handlers match it
// against the stack top. Only the first screen after the drawer matches —
// navigating deeper leaves it stale (harmless) until a new drawer nav
// replaces it.

let drawerOrigin: string | null = null;
let drawerOpener: (() => void) | null = null;

export function markDrawerOrigin(href: string): void {
  drawerOrigin = href;
}

export function drawerOriginHref(): string | null {
  return drawerOrigin;
}

export function clearDrawerOrigin(): void {
  drawerOrigin = null;
}

/** DrawerContent registers its openDrawer so back handlers can reopen the
 *  drawer without prop plumbing. */
export function registerDrawerOpener(open: () => void): void {
  drawerOpener = open;
}

export function openDrawerViaOpener(): boolean {
  if (!drawerOpener) return false;
  drawerOpener();
  return true;
}

/** THE back decision, shared by ScreenHeader, DashboardHeader and the
 *  hardware-back handler. A screen whose top-of-stack matches the drawer
 *  origin goes back TO THE DRAWER (reopened). Otherwise the click path is
 *  walked; null href = path exhausted, go home to chat. */
export function resolveBack(): { kind: 'drawer' } | { kind: 'route'; href: string | null } {
  if (drawerOrigin && drawerOrigin === peekDrawerTop()) {
    clearDrawerOrigin();
    stack.pop(); // leaving this screen
    return { kind: 'drawer' };
  }
  return { kind: 'route', href: drawerBackTarget() };
}

/** Whether the drawer is currently open — tracked by DrawerContent's
 *  navigation events; the hardware-back handler reads it so an open drawer
 *  still closes on back instead of navigating. */
let drawerOpen = false;
export function setDrawerOpen(open: boolean): void {
  drawerOpen = open;
}
export function isDrawerOpen(): boolean {
  return drawerOpen;
}

/** Test-only: reset between cases. */
export function resetDrawerHistory(): void {
  stack.length = 0;
  drawerOpen = false;
  drawerOrigin = null;
}
