import {appAnalytics,trackCaptureTiming} from '../lib/clientAnalytics';
import {appPlatform,appVersion} from '../lib/analytics';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { apiUrl } from '../lib/api';
import { startEventStream } from '../lib/sse';
import { supabase } from '../lib/supabase';
import { refreshFeedHead } from '../lib/thread';

export function EventStreamBridge({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let stop: (() => void) | null = null;

    const connect = () => {
      if (stop) return;
      void refreshFeedHead(queryClient);
      stop = startEventStream(queryClient, {
        url: apiUrl('/v1/events'),
        refreshFeed: () => refreshFeedHead(queryClient),
        onTiming: timing=>{void supabase.auth.getSession().then(({data})=>{
          trackCaptureTiming(appAnalytics(data.session?.user.id??null),{...timing,platform:appPlatform(),app_version:appVersion()});
        }).catch(()=>{});},
        getToken: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        },
      });
    };
    const disconnect = () => {
      stop?.();
      stop = null;
    };

    if (AppState.currentState === 'active') connect();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') connect();
      else disconnect();
    });
    return () => {
      subscription.remove();
      disconnect();
    };
  }, [enabled, queryClient]);

  return null;
}
