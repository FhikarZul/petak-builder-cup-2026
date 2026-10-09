// lib/photoBatch.ts — plan §8: grouping (contiguity, minute boundary, an
// interleaved reply breaks a batch). PURE module, node environment.
import { describe, expect, it } from 'vitest';
import { collapsePhotoBatches, minuteLabel, sameMinute, batchTiles } from './photoBatch';

interface Item {
  id: string;
  createdAt: string;
  batchable: boolean;
}

const photo = (id: string, createdAt: string): Item => ({ id, createdAt, batchable: true });
const other = (id: string, createdAt: string): Item => ({ id, createdAt, batchable: false });

describe('minute helpers', () => {
  it('minuteLabel renders local HH:MM', () => {
    const d = new Date(2026, 7, 26, 21, 17);
    expect(minuteLabel(d.toISOString())).toBe('21:17');
  });
  it('sameMinute compares wall-clock minutes', () => {
    const a = new Date(2026, 7, 26, 21, 17, 5).toISOString();
    const b = new Date(2026, 7, 26, 21, 17, 55).toISOString();
    const c = new Date(2026, 7, 26, 21, 18, 0).toISOString();
    expect(sameMinute(a, b)).toBe(true);
    expect(sameMinute(a, c)).toBe(false);
  });
});

describe('collapsePhotoBatches (plan §5 — "+N photos · time · Sent")', () => {
  const t = (m: number, s = 0) => new Date(2026, 7, 26, 21, m, s).toISOString();

  it('consecutive own photo cards in one minute collapse to one batch', () => {
    const rows = collapsePhotoBatches([photo('a', t(17, 1)), photo('b', t(17, 20)), photo('c', t(17, 59))]);
    expect(rows).toEqual([
      {
        kind: 'batch',
        items: [photo('a', t(17, 1)), photo('b', t(17, 20)), photo('c', t(17, 59))],
        count: 3,
        minute: '21:17',
      },
    ]);
  });

  it('a lone photo renders single', () => {
    const rows = collapsePhotoBatches([photo('a', t(17))]);
    expect(rows).toEqual([{ kind: 'single', item: photo('a', t(17)) }]);
  });

  it('the minute boundary splits a run into two groups', () => {
    const rows = collapsePhotoBatches([photo('a', t(17, 50)), photo('b', t(17, 59)), photo('c', t(18, 1)), photo('d', t(18, 30))]);
    expect(rows.map((r) => r.kind)).toEqual(['batch', 'batch']);
    expect(rows[0]).toMatchObject({ count: 2, minute: '21:17' });
    expect(rows[1]).toMatchObject({ count: 2, minute: '21:18' });
  });

  it('an interleaved reply breaks the batch', () => {
    const rows = collapsePhotoBatches([
      photo('a', t(17, 1)),
      photo('b', t(17, 10)),
      other('reply', t(17, 20)),
      photo('c', t(17, 30)),
      photo('d', t(17, 40)),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['batch', 'single', 'batch']);
    expect(rows[0]).toMatchObject({ count: 2 });
    expect(rows[1]).toEqual({ kind: 'single', item: other('reply', t(17, 20)) });
    expect(rows[2]).toMatchObject({ count: 2 });
  });

  it('an unsent (non-batchable) photo card renders single and breaks the run', () => {
    const rows = collapsePhotoBatches([
      photo('a', t(17, 1)),
      other('sending', t(17, 10)),
      photo('b', t(17, 20)),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['single', 'single', 'single']);
  });

  it('non-contiguous singles never merge across a message', () => {
    const rows = collapsePhotoBatches([photo('a', t(17)), other('m', t(17)), photo('b', t(17))]);
    expect(rows.map((r) => r.kind)).toEqual(['single', 'single', 'single']);
  });

  it('order is preserved across a mixed thread', () => {
    const rows = collapsePhotoBatches([
      other('m1', t(10)),
      photo('a', t(11, 1)),
      photo('b', t(11, 2)),
      other('m2', t(12)),
    ]);
    expect(rows.map((r) => (r.kind === 'batch' ? `batch:${r.count}` : (r as { item: Item }).item.id))).toEqual([
      'm1',
      'batch:2',
      'm2',
    ]);
  });
});

describe('batchTiles (#77 — four thumbnails then a +N tile)', () => {
  it('nine photos → four shown, five over', () => {
    expect(batchTiles(9)).toEqual({ shown: 4, overflow: 5 });
  });
  it('exactly four → four shown, NO overflow tile', () => {
    expect(batchTiles(4)).toEqual({ shown: 4, overflow: 0 });
  });
  it('two → two shown, no tile', () => {
    expect(batchTiles(2)).toEqual({ shown: 2, overflow: 0 });
  });
  it('never shows a negative overflow', () => {
    expect(batchTiles(1)).toEqual({ shown: 1, overflow: 0 });
    expect(batchTiles(0)).toEqual({ shown: 0, overflow: 0 });
  });
});
