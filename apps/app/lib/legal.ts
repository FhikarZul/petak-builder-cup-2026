import { apiFetch } from './api';
export { shouldBlockForLegal } from './legalGate';

export interface LegalStatus {
  accepted: boolean;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  is_reviewer: boolean;
}

export async function fetchLegalStatus(): Promise<LegalStatus> {
  return apiFetch<LegalStatus>('/v1/legal/status');
}

export async function acceptLegal(): Promise<LegalStatus> {
  return apiFetch<LegalStatus>('/v1/legal/accept', {
    method: 'POST',
    body: JSON.stringify({ accepted: true }),
  });
}
