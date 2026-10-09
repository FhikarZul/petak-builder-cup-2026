// The backup lane (founder, 7 Sep 2026), added because ONE typo took out ALL
// analytics for the life of the product (internal-reference) — there was only ever one
// lane, and the app had no PostHog client at all.
import { describe, expect, it, vi } from 'vitest';
import { CLIENT_VERBS, isClientVerb, trackClient, trackCaptureTiming } from './clientAnalytics';

it('meters capture timing without content or signed URLs and without duplicating ledger events', () => {
  const fetchFn = vi.fn().mockResolvedValue({ ok: true });
  trackCaptureTiming(cfg({ fetchFn, environment: 'qa' }), {
    stage: 'upload', photo_id: 'photo', duration_ms: 123, success: true, platform: 'ios', app_version: '0.1.0',
    caption: 'private', upload_url: 'secret-url',
  } as never);
  const event = JSON.parse(fetchFn.mock.calls[0][1].body);
  expect(event.event).toBe('$capture_timing');
  expect(event.properties).toMatchObject({ duration_ms: 123, environment: 'qa', lane: 'client', timing_version: 1 });
  expect(event.properties.caption).toBeUndefined();
  expect(event.properties.upload_url).toBeUndefined();
});

const cfg = (over: Record<string, unknown> = {}) =>
  ({ key: 'phc_test', host: 'https://us.i.posthog.com', distinctId: 'user-1', ...over }) as never;

describe('the client lane sends', () => {
  it('posts the same shape the server does, to the same endpoint', () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    trackClient(cfg({ fetchFn }), 'app_opened');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/capture/');
    expect(JSON.parse(init.body as string)).toMatchObject({
      api_key: 'phc_test',
      event: 'app_opened',
      distinct_id: 'user-1',
    });
  });

  it('marks itself as the client lane, so the two stay separable', () => {
    // Without this the lanes are indistinguishable in PostHog, and any figure
    // both could produce becomes untrustworthy.
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    trackClient(cfg({ fetchFn }), 'screen_viewed', { screen: 'penny' });
    const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.properties).toMatchObject({ screen: 'penny', lane: 'client' });
  });

  it('sends "anonymous" before sign-in rather than nothing', () => {
    // An event with nobody attached is still a heartbeat, and the heartbeat is
    // the whole point of this lane.
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    trackClient(cfg({ fetchFn, distinctId: null }), 'app_opened');
    const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.distinct_id).toBe('anonymous');
  });

  // z8v0kmr81k — QA and prod share one PostHog project. Every event says
  // which build it came from, and the call site cannot override it.
  it('stamps the environment, and a call site cannot relabel it', () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    trackClient(cfg({ fetchFn, environment: 'qa' }), 'app_opened', { environment: 'prod' });
    const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.properties.environment).toBe('qa');
  });

  it('an unconfigured build is `dev`, never blank', () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    trackClient(cfg({ fetchFn }), 'app_opened');
    const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.properties.environment).toBe('dev');
  });
});

describe('the client lane refuses', () => {
  it('sends nothing without a token — dev and test never talk to PostHog', () => {
    const fetchFn = vi.fn();
    trackClient(cfg({ fetchFn, key: undefined }), 'app_opened');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses a verb outside C26's list — a whitelist nothing checks is a suggestion", () => {
    const fetchFn = vi.fn();
    trackClient(cfg({ fetchFn }), 'photo_extracted' as never);
    expect(fetchFn, 'a server verb sent from here would double-count').not.toHaveBeenCalled();
  });

  it('never throws when the network is gone', () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    expect(() => trackClient(cfg({ fetchFn }), 'app_opened')).not.toThrow();
  });
});

describe('the two lanes do not overlap', () => {
  it('carries no ledger verb — those are facts about records the app cannot witness', () => {
    for (const serverVerb of ['photo_extracted', 'neighbour_responded', 'feedback_sent', 'account_erased']) {
      expect(isClientVerb(serverVerb), `${serverVerb} is the server's — sending it here double-counts`).toBe(false);
    }
  });

  it('keeps its own list short and closed', () => {
    expect(CLIENT_VERBS).toEqual(['app_opened', 'screen_viewed', 'send_attempted', 'send_failed']);
  });
});

it('emits auditable visible progress without fabricating duration or retaining content',()=>{
 const fetchFn=vi.fn().mockResolvedValue({ok:true});
 trackCaptureTiming(cfg({fetchFn}),{stage:'progress_visible',photo_id:'photo-a',at_ms:1500,
  progress_stage:'clarification_needed',previous_progress_stage:'reading',progress_observed_at:'2026-10-08T12:00:00Z',transition_seq:2,
  repeated_layout_count:1,stale_layout_count:1,platform:'ios',app_version:'0.1.0',caption:'SECRET',provider_response:'SECRET'} as never);
 const payload=JSON.parse(fetchFn.mock.calls[0][1].body);
 expect(payload.properties).toMatchObject({stage:'progress_visible',progress_stage:'clarification_needed',transition_seq:2,repeated_layout_count:1,stale_layout_count:1});
 expect(payload.properties.duration_ms).toBeUndefined();expect(JSON.stringify(payload)).not.toContain('SECRET');
});
