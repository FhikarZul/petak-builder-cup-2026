import { CaptureVisibilityContext } from './CaptureVisibilityContext';
import type { CaptureProgress } from '@petak/config/capture-progress';
import { useContext, useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { captureProgressView } from '../lib/captureProgress';
import { usePhotoState, refreshFeedHead } from '../lib/thread';
import { useTheme } from '../lib/theme';

/** The existing photo card owns this text. No assistant message is fabricated
 * and a transport failure cannot masquerade as a failed or successful read. */
export function CaptureProgressStatus({ photoId }: { photoId: string }) {
  const photo = usePhotoState(photoId);
  const qc = useQueryClient();
  const progress = photo.data?.progress;
  const previousStage = useRef(progress?.stage);
  useEffect(() => {
    const previous = previousStage.current;
    previousStage.current = progress?.stage;
    if (previous && previous !== progress?.stage && (progress?.stage === 'published' || progress?.stage === 'clarification_needed')) void refreshFeedHead(qc);
  }, [photoId, progress?.stage, qc]);
  return <CaptureProgressText photoId={photoId} progress={progress} error={photo.isError} />;
}

export function CaptureProgressText({ photoId, progress, error }: { photoId: string; progress?: CaptureProgress; error: boolean }) {
  const t = useTheme();
  const visibility = useContext(CaptureVisibilityContext);
  const view = captureProgressView(photoId, progress);
  const text = error ? 'Couldn’t check progress' : view?.text;
  useEffect(() => {
    if (error || !view) visibility?.progressUnavailable(photoId);
  }, [error, !!view, photoId, visibility]);
  if (!text) return null;
  return <Text key={error ? 'unavailable' : progress?.stage} onLayout={() => { if (!error && progress && view) visibility?.progressLayout(progress); else visibility?.progressUnavailable(photoId); }} accessibilityLiveRegion="polite" style={{ color: !error && view?.failed ? t.color.error : t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, marginTop: 6 }}>{text}</Text>;
}
