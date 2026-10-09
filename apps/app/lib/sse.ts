// C61 realtime: ONE SSE stream, server→client, GET /v1/events with an
// Authorization header. Client sends via normal POST (lib/api.ts).
//
// Implementation choice: react-native-sse was evaluated and rejected — it is
// an unmaintained XHR wrapper whose last release predates the new RN
// architecture; RN's fetch cannot stream response bodies, so this is a
// minimal XHR-based reader (the same mechanism, zero dependencies). It sets
// Authorization + Last-Event-ID headers and reconnects with backoff.
import type { QueryClient } from '@tanstack/react-query';

export interface ServerEvent {
  id: string | null;
  event: string;
  data: string;
}

export interface SseClientOptions {
  url: string;
  getToken: () => Promise<string | null>;
  onEvent: (event: ServerEvent) => void;
  onOpen?: () => void;
  onError?: (error: unknown) => void;
}

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

// Incremental SSE frame parser: feeds raw text chunks, emits whole events.
export function createSseParser(onEvent: (event: ServerEvent) => void) {
  let buffer = '';
  let id: string | null = null;
  let event = 'message';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      id = null;
      event = 'message';
      return;
    }
    onEvent({ id, event, data: dataLines.join('\n') });
    id = null;
    event = 'message';
    dataLines = [];
  };

  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') {
        dispatch();
      } else if (line.startsWith(':')) {
        // comment / heartbeat — ignore
      } else {
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'id') id = value;
        else if (field === 'event') event = value;
        else if (field === 'data') dataLines.push(value);
      }
    }
  };
}

export function connectEventStream(options: SseClientOptions): () => void {
  let stopped = false;
  let retryMs = MIN_RETRY_MS;
  let lastEventId: string | null = null;
  let xhr: XMLHttpRequest | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleReconnect = () => {
    if (stopped || timer) return;
    timer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  };

  const connect = async () => {
    if (stopped) return;
    timer = null;
    let token: string | null;
    try {
      token = await options.getToken();
    } catch (error) {
      options.onError?.(error);
      scheduleReconnect();
      return;
    }
    if (stopped) return;

    const parse = createSseParser((event) => {
      if (event.id) lastEventId = event.id;
      options.onEvent(event);
    });

    let received = 0;
    let opened = false;
    xhr = new XMLHttpRequest();
    xhr.open('GET', options.url);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (lastEventId) xhr.setRequestHeader('Last-Event-ID', lastEventId);

    xhr.onprogress = () => {
      const text = xhr?.responseText ?? '';
      parse(text.slice(received));
      received = text.length;
      retryMs = MIN_RETRY_MS; // a live stream resets the backoff
      if (!opened) {
        opened = true;
        options.onOpen?.();
      }
    };
    xhr.onerror = () => {
      options.onError?.(new Error('SSE connection error'));
      scheduleReconnect();
    };
    xhr.onload = () => scheduleReconnect(); // server closed the stream
    xhr.send();
  };

  void connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    xhr?.abort();
  };
}

function eventPayload(event: ServerEvent): Record<string, unknown> {
  try {
    const parsed = JSON.parse(event.data) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function eventQueryKeys(event: ServerEvent): readonly (readonly unknown[])[] {
  const payload = eventPayload(event);
  const neighbour = typeof payload.neighbour === 'string' ? payload.neighbour : null;
  switch (event.event) {
    case 'message.new':
      return [['threads']];
    case 'task.opened':
    case 'task.resolved':
      return [['tasks']];
    case 'credits.changed':
      return [['street'], ['wallet']];
    case 'photo.progress':
    case 'photo.reading':
      return typeof payload.photo_id === 'string' ? [['photo', payload.photo_id]] : [];
    case 'entry.filed':
    case 'entry.amended': {
      if (!neighbour) return [];
      const common: (readonly unknown[])[] = [['entries', neighbour], ['today', neighbour]];
      if (neighbour === 'penny') {
        return [...common, ['categories'], ['series', 'penny'], ['penny-log'],
          ...(event.event === 'entry.amended' ? [['feed'], ['thread', 'penny']] : [])];
      }
      if (neighbour === 'milo') return [...common, ['milo-log'],
        ...(event.event === 'entry.amended' ? [['trail'], ['feed'], ['thread', 'milo']] : [])];
      if (neighbour === 'mira') return [...common, ['journal', 'mira']];
      return common;
    }
    default:
      return [];
  }
}

// C61 nudges invalidate the query keys the merged-feed app actually owns.
// Event names are not query keys: keeping this mapping explicit prevents a
// navigation refactor from silently making realtime deaf again.
export function startEventStream(
  queryClient: QueryClient,
  options: Omit<SseClientOptions, 'onEvent'> & { refreshFeed?: () => void | Promise<void>; onTiming?: (timing:{stage:'sse_received'|'refetch';event_seq?:string;message_id?:string;photo_id?:string;started_at_ms:number;at_ms:number;duration_ms:number;success?:boolean})=>void },
): () => void {
  const { refreshFeed, onTiming, ...streamOptions } = options;
  return connectEventStream({
    ...streamOptions,
    onOpen: () => {
      // Amendments can land while disconnected, including on older pages.
      // A head-only sync cannot refresh those already-loaded receipt cards.
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['thread'] });
      void queryClient.invalidateQueries({ queryKey: ['photo'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
      streamOptions.onOpen?.();
    },
    onEvent: (event) => {
      if (['message.new', 'photo.reading', 'photo.progress', 'entry.filed', 'task.opened'].includes(event.event)) {
        void queryClient.invalidateQueries({ queryKey: ['activity'] });
      }
      if (event.event === 'message.new' || event.event === 'photo.reading') {
        const start=Date.now(),payload=eventPayload(event);
        const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const metadata={event_seq:event.id&&/^\d{1,20}$/.test(event.id)?event.id:undefined,
          message_id:typeof payload.message_id==='string'&&uuid.test(payload.message_id)?payload.message_id:undefined,
          photo_id:typeof payload.photo_id==='string'&&uuid.test(payload.photo_id)?payload.photo_id:undefined};
        const note=(stage:'sse_received'|'refetch',success?:boolean)=>{
          try { onTiming?.({stage,...metadata,started_at_ms:start,at_ms:Date.now(),duration_ms:Math.max(0,Date.now()-start),success}); } catch { /* observation only */ }
        };
        note('sse_received');
        if(event.event==='message.new') {
          const result=refreshFeed?.();
          void Promise.resolve(result).then(()=>note('refetch',true),()=>note('refetch',false));
        }
      }
      for (const queryKey of eventQueryKeys(event)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
