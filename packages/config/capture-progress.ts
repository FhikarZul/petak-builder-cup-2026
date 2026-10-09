// Client-visible progress states returned by the Petak API.
export const captureProgressStages = [
  'awaiting_upload', 'accepted', 'reading', 'enriching', 'publication_waiting',
  'published', 'clarification_needed', 'failed', 'outcome_unknown', 'waiting_allowance',
] as const;

export type CaptureProgressStage = (typeof captureProgressStages)[number];

export interface CaptureProgress {
  photo_id: string;
  stage: CaptureProgressStage;
  observed_at: string;
}
