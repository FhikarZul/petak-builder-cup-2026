import { createContext } from 'react';
import type { CaptureProgress } from '@petak/config/capture-progress';
import type { TimedCapture } from '../lib/captureTiming';

/** Optional measurement callbacks; cards still render outside the chat feed. */
export const CaptureVisibilityContext = createContext<{
  localLayout: (capture: TimedCapture) => void;
  progressUnavailable: (photoId: string) => void;
  progressLayout: (progress: CaptureProgress) => void;
} | null>(null);
