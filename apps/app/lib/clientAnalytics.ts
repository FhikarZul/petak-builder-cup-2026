import type { CaptureProgressStage } from '@petak/config/capture-progress';
// The CLIENT lane — a backup, and a canary (founder, 7 Sep 2026: "with client
// side as backup").
//
// WHY IT EXISTS. Server analytics reached nothing for the life of the product
// (internal-reference): the host default was `us.i.posthog.io`, which does not resolve,
// and every failure was swallowed. ONE typo took out ALL analytics, because
// there was only ever one lane and the app had no PostHog client at all.
//
// So this is a SECOND lane with a different failure mode: a different host
// string, a different network, a different process. If the server lane dies
// again, this one keeps reporting — and the gap between them is the alarm.
//
// NOT A DUPLICATE. Overlap would double-count every figure and make both lanes
// untrustworthy. The split is by what each side can actually see:
//
//   SERVER  the ledger verbs — photo_extracted, neighbour_responded,
//           feedback_sent. Facts about RECORDS, which the app cannot witness.
//   CLIENT  the session — app opened, screen viewed, a send attempted. Facts
//           about a PERSON USING A PHONE, which the server cannot witness.
//
// `app_opened` is the heartbeat: if the server lane is dead, client events
// still arrive and the contrast between them says so.
//
// NO SDK. posthog-react-native is ~200KB for a POST this file does in ten
// lines, and the server has been making exactly that POST all along. Same
// reasoning as GridWallpaper and DomainCard: no dependency for a thing that is
// plainer written out.
//
// C26 still governs the vocabulary: the verb list is CLOSED, and a new verb is
// a canon PR rather than an import.

/** The client's verbs. Deliberately few, and deliberately not the server's. */
export const CLIENT_VERBS = ['app_opened', 'screen_viewed', 'send_attempted', 'send_failed'] as const;
export type ClientVerb = (typeof CLIENT_VERBS)[number];

export interface ClientAnalyticsConfig {
  /** The PostHog project token. Public by design — it can only write. */
  key: string | undefined;
  host: string;
  /** The signed-in user, so the two lanes join on one person. Anonymous before
   *  sign-in: an event with nobody attached is still a heartbeat. */
  distinctId: string | null;
  /** Which build this is — `qa` from Codemagic's QA workflow, `prod` from the
   *  store build. Stamped on every event (z8v0kmr81k). */
  environment?: 'dev' | 'qa' | 'prod';
  fetchFn?: typeof globalThis.fetch;
}

/** Is this verb one the client may send? C26's whitelist, ENFORCED rather than
 *  documented — a verb list nothing checks is a suggestion. */
export function isClientVerb(verb: string): verb is ClientVerb {
  return (CLIENT_VERBS as readonly string[]).includes(verb);
}

/**
 * Send one event. Never throws, never blocks, never retries.
 *
 * Analytics must not break an app any more than it may break a worker — but
 * unlike the server there is nobody here to alert, so a failure is simply
 * dropped. The SERVER lane raises the alarm; this lane's job is to still be
 * arriving when that one is not.
 */
export function trackClient(
  config: ClientAnalyticsConfig,
  verb: ClientVerb,
  props: Record<string, unknown> = {},
): void {
  if (!config.key) return; // no token = no-op, same rule as the server
  if (!isClientVerb(verb)) return; // an un-whitelisted verb is a bug, not an event
  sendClientEvent(config, verb, props);
}

/** Infrastructure stage meter, explicitly requested for photo benchmarks.
 * Separate from the closed product verbs and never a server ledger event. */
export function trackCaptureTiming(config: ClientAnalyticsConfig, props: {
  stage: 'create' | 'upload' | 'message' | 'accept' | 'first_result_in_feed' | 'sse_received' | 'refetch' | 'local_ack_visible' | 'progress_visible';
  capture_key?: string; started_at_ms?: number; at_ms?: number; event_seq?: string; message_id?: string;
  photo_id?: string; duration_ms?: number; success?: boolean; resumed?: boolean;
  progress_stage?: CaptureProgressStage; previous_progress_stage?: CaptureProgressStage; progress_observed_at?: string;
  visibility_session_id?: string; transition_seq?: number; repeated_layout_count?: number; stale_layout_count?: number;
  foreground_continuous?: boolean; upload_attempts?: number; platform: string; app_version: string;
}): void {
  if (!config.key || !config.distinctId || (props.duration_ms === undefined && props.stage !== 'progress_visible') || (props.duration_ms !== undefined && (!Number.isFinite(props.duration_ms) || props.duration_ms < 0))) return;
  const { visibility_session_id, progress_stage, previous_progress_stage, progress_observed_at, transition_seq, repeated_layout_count, stale_layout_count, stage, photo_id, capture_key, started_at_ms, at_ms, event_seq, message_id, duration_ms, success, resumed, foreground_continuous, upload_attempts, platform, app_version } = props;
  sendClientEvent(config, '$capture_timing', { stage, photo_id, capture_key, started_at_ms, at_ms:at_ms??Date.now(), event_seq, message_id, duration_ms, success, resumed,
    foreground_continuous, upload_attempts, platform, app_version, visibility_session_id, progress_stage, previous_progress_stage, progress_observed_at, transition_seq, repeated_layout_count, stale_layout_count, timing_version: 1 });
}

function sendClientEvent(config: ClientAnalyticsConfig, verb: string, props: Record<string, unknown>): void {
  const doFetch = config.fetchFn ?? globalThis.fetch;
  void doFetch(`${config.host}/capture/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: config.key,
      event: verb,
      distinct_id: config.distinctId ?? 'anonymous',
      // `lane` so the two lanes stay separable (C113); `environment` so QA
      // testing is separable from real traffic (z8v0kmr81k). Both applied
      // AFTER the call site's props: neither can be forgotten or overridden.
      properties: { ...props, lane: 'client', environment: config.environment ?? 'dev' },
    }),
  }).catch(() => {
    // Dropped on purpose. See above: this lane has no alarm of its own.
  });
}

/** The app's own lane, configured from the environment.
 *
 *  `EXPO_PUBLIC_POSTHOG_KEY` absent = no-op, so a build without it is silent
 *  rather than broken — the same rule the server follows. The host defaults to
 *  the one that ACTUALLY RESOLVES; the whole reason this file exists is that
 *  the server's default did not.
 */
export function appAnalytics(distinctId: string | null): ClientAnalyticsConfig {
  const env = process.env.EXPO_PUBLIC_PETAK_ENV;
  return {
    key: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    distinctId,
    // codemagic.yaml already sets EXPO_PUBLIC_PETAK_ENV per workflow; an
    // unrecognised or missing value is `dev`, never blank.
    environment: env === 'qa' || env === 'prod' ? env : 'dev',
  };
}
