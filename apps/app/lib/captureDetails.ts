export function compactCaptureDetails(raw: unknown, details: { question: string | null }[]): boolean {
  return Array.isArray(raw) && raw.some(b => b !== null && typeof b === 'object'
    && b.kind === 'capture_context' && typeof b.photo_id === 'string' && b.photo_id.length > 0)
    && !details.some(b => Boolean(b.question));
}
