import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { shouldRefreshActivityFeed, type BackgroundActivity } from './activity';
import { requestActivity } from './requestActivity';
import { refreshFeedHead } from './thread';
import { useSession } from './supabase';

export interface ActivitySnapshot { activities: BackgroundActivity[] }

/** Snapshot + SSE invalidation + fallback polling. The response is published
 * only after the feed refresh: a completed job cannot remove its indicator
 * before its committed reply is in the cache. */
export function useActivity() {
  const qc = useQueryClient();
  const userId = useSession()?.user.id;
  const [active, setActive] = useState(AppState.currentState === 'active');
  const key = ['activity', userId] as const;
  const requests = useSyncExternalStore(requestActivity.subscribe, requestActivity.snapshot, requestActivity.snapshot);
  const query = useQuery({
    queryKey: key,
    enabled: !!userId && active,
    queryFn: async () => {
      const snapshot = await apiFetch<ActivitySnapshot>('/v1/activity');
      const previous = qc.getQueryData<ActivitySnapshot>(key);
      if (shouldRefreshActivityFeed(previous?.activities, snapshot.activities)) await refreshFeedHead(qc, true);
      return snapshot;
    },
    staleTime: 0,
    retry: false,
    refetchInterval: query => query.state.data?.activities.some(a => a.state === 'running' || a.state === 'queued' || a.state === 'retrying') ? 2_000 : 10_000,
  });
  useEffect(() => {
    requestActivity.setRefresh(async () => {
      await refreshFeedHead(qc, true);
      await qc.invalidateQueries({queryKey:['activity']}, {throwOnError:true});
    });
    const sub = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') void qc.invalidateQueries({queryKey:['activity']});
    });
    return () => { requestActivity.setRefresh(undefined); requestActivity.clear(); sub.remove(); };
  }, [qc, userId]);
  return { ...query, requests };
}
