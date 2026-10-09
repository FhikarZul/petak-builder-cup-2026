import React from 'react';
import { expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.stubGlobal('React', React);
import { JournalMemoryEvidence } from '../components/dashboard/JournalMemoryEvidence';
import type { JournalEntry } from './dashboard';
import type { Theme } from './theme';
const t = { color: {}, typography: { textBody: {}, textSmall: {} } } as Theme;
function text(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(text).join(' ');
  return React.isValidElement(node) ? text((node.props as { children?: unknown }).children) : '';
}
const entry: JournalEntry = { id: 'entry', at: '2026-09-22T09:00:00Z', scene: 'Boxes by a doorway.', raw: 'My original caption!', emotion: 'hopeful', photo_id: 'photo' };

it('labels the interpretation as tentative and names each evidence source', () => {
  const rendered = text(JournalMemoryEvidence({ t, entry: { ...entry, emotion_evidence: 'I feel hopeful',
    interpretation: { summary: 'This may be a new beginning.', evidence: [
      { source: 'caption', detail: 'about this move' }, { source: 'photo', detail: 'Packed boxes' },
    ] },
  } }));
  expect(rendered).toContain('Mira’s reading · tentative');
  expect(rendered).toContain('This may be a new beginning.');
  expect(rendered).toContain('Your caption');
  expect(rendered).toContain('Photo detail');
  expect(rendered).toContain('I feel hopeful');
  expect(rendered).not.toContain(entry.raw); // verbatim words remain in their separate raw block
});
it('adds no inferred reading to legacy entries without evidence', () => {
  expect(JournalMemoryEvidence({ entry, t })).toBeNull();
});
