// Click-path back (founder ruling 1 Sep 2026). The pure walk of the visit
// stack the Drawer layout records — every case is a founder repro.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDrawerOrigin,
  drawerBackTarget,
  drawerOriginHref,
  markDrawerOrigin,
  recordDrawerVisit,
  resetDrawerHistory,
  resolveBack,
} from './drawerHistory';

const SETTINGS = 'settings';
const NOTIFICATIONS = 'settings/notifications';
const HOUSEHOLD = 'household';
const MOVING_OUT = 'household/moving-out';
const PENNY = 'dashboards/penny';
const MILO = 'dashboards/milo';

beforeEach(resetDrawerHistory);

describe('recordDrawerVisit', () => {
  it('never records chat (index) — chat is the bottom of the path', () => {
    recordDrawerVisit('index');
    expect(drawerBackTarget()).toBeNull();
  });

  it('ignores unknown route names', () => {
    recordDrawerVisit('photos-waiting');
    expect(drawerBackTarget()).toBeNull();
  });

  it('dedupes a consecutive visit to the same screen', () => {
    recordDrawerVisit(SETTINGS);
    recordDrawerVisit(SETTINGS);
    expect(drawerBackTarget()).toBeNull();
  });
});

describe('drawerBackTarget — the click path', () => {
  it('chat → Settings → Notifications: back walks Settings, then chat', () => {
    recordDrawerVisit(SETTINGS);
    recordDrawerVisit(NOTIFICATIONS);
    expect(drawerBackTarget()).toBe('/(drawer)/settings');
    // Re-focus after the back navigation must not duplicate the entry.
    recordDrawerVisit(SETTINGS);
    expect(drawerBackTarget()).toBeNull();
  });

  it('chat → Your neighbours → Moving out: back returns to Your neighbours', () => {
    recordDrawerVisit(HOUSEHOLD);
    recordDrawerVisit(MOVING_OUT);
    expect(drawerBackTarget()).toBe('/(drawer)/household');
  });

  it('chat → Penny → Milo: back returns to Penny, then chat', () => {
    recordDrawerVisit(PENNY);
    recordDrawerVisit(MILO);
    expect(drawerBackTarget()).toBe('/(drawer)/dashboards/penny');
    recordDrawerVisit(PENNY);
    expect(drawerBackTarget()).toBeNull();
  });

  it('chat → Settings → back → chat → Milo: the new path starts clean', () => {
    recordDrawerVisit(SETTINGS);
    expect(drawerBackTarget()).toBeNull();
    recordDrawerVisit(MILO);
    expect(drawerBackTarget()).toBeNull();
  });
});

describe('resolveBack — drawer-origin returns to the drawer (2 Sep ruling)', () => {
  it('drawer → Your neighbours: back REOPENS the drawer instead of walking', () => {
    markDrawerOrigin('/(drawer)/household');
    recordDrawerVisit(HOUSEHOLD);
    expect(resolveBack()).toEqual({ kind: 'drawer' });
    // The screen left the path; a second back would fall through to chat.
    expect(drawerOriginHref()).toBeNull();
    expect(resolveBack()).toEqual({ kind: 'route', href: null });
  });

  it('drawer → Your neighbours → Moving out: deep back still walks, then drawer', () => {
    markDrawerOrigin('/(drawer)/household');
    recordDrawerVisit(HOUSEHOLD);
    recordDrawerVisit(MOVING_OUT);
    // Back on Moving out: origin (household) does not match top — walk.
    expect(resolveBack()).toEqual({ kind: 'route', href: '/(drawer)/household' });
    // Re-focus after the back navigation.
    recordDrawerVisit(HOUSEHOLD);
    // Back on Your neighbours: origin matches top — reopen the drawer.
    expect(resolveBack()).toEqual({ kind: 'drawer' });
  });

  it('a screen reached WITHOUT the drawer (e.g. a mention tap) never reopens it', () => {
    recordDrawerVisit(PENNY); // no markDrawerOrigin
    expect(resolveBack()).toEqual({ kind: 'route', href: null });
  });

  it('a stale origin is replaced by the next drawer navigation', () => {
    markDrawerOrigin('/(drawer)/household');
    recordDrawerVisit(HOUSEHOLD);
    recordDrawerVisit(SETTINGS); // deeper nav from the household screen
    expect(drawerOriginHref()).toBe('/(drawer)/household'); // untouched
    clearDrawerOrigin();
    markDrawerOrigin('/(drawer)/settings');
    recordDrawerVisit(NOTIFICATIONS);
    expect(resolveBack()).toEqual({ kind: 'route', href: '/(drawer)/settings' });
  });
});
