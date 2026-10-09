// internal-reference — the board rendered every row as "Answer Penny in chat", the same
// eleven words eleven times, telling you nothing about which question you were
// about to answer.
import { describe, expect, it } from 'vitest';
import {
  boardView,
  filterByStatus,
  nextStatuses,
  searchTasks,
  statusCounts,
  taskCountLine,
  taskTitle,
  transitionLabel,
  waitedFor,
  TASK_STATUSES,
  type BoardTask,
} from './boardTasks';

const task = (over: Partial<BoardTask> = {}): BoardTask => ({
  id: 'a',
  neighbour: 'penny',
  kind: 'confirm_category',
  status: 'planned',
  asked_at: '2026-09-07T10:00:00.000Z',
  origin_message_id: 'm1',
  ...over,
});

describe('what a task row says', () => {
  it('names the actual question, not the mechanism', () => {
    expect(taskTitle('confirm_dish')).toBe('What was in it?');
    expect(taskTitle('confirm_category')).toBe('Which category?');
    expect(taskTitle('milo_objective')).toBe('What are we working toward?');
  });

  it('falls back for a kind this build has never heard of', () => {
    // The server ships new kinds by PR; an older app must still render the row
    // and still open the message. Less specific beats blank or a raw enum.
    expect(taskTitle('some_future_kind')).toBe('Answer in chat');
  });

  it('never shows a raw enum to a person', () => {
    for (const kind of ['confirm_dish', 'link_photos_confirm', 'weekly_draft', 'unknown_kind']) {
      expect(taskTitle(kind)).not.toContain('_');
    }
  });
});

describe('how long it has waited', () => {
  const now = new Date('2026-09-07T12:00:00.000Z');

  it('is coarse on purpose — a board that counts minutes at you is nagging', () => {
    // C06 forbids nagging. Eleven minutes and fourteen minutes are the same
    // question.
    expect(waitedFor('2026-09-07T11:59:30.000Z', now)).toBe('just now');
    expect(waitedFor('2026-09-07T11:30:00.000Z', now)).toBe('30m ago');
    expect(waitedFor('2026-09-07T09:00:00.000Z', now)).toBe('3h ago');
    expect(waitedFor('2026-09-06T12:00:00.000Z', now)).toBe('yesterday');
    expect(waitedFor('2026-09-04T12:00:00.000Z', now)).toBe('3d ago');
  });

  it('says NOTHING for a time it cannot read, rather than guessing', () => {
    expect(waitedFor('not-a-date', now)).toBe('');
    expect(waitedFor('', now)).toBe('');
  });

  it('never goes negative on a clock that is slightly ahead', () => {
    expect(waitedFor('2026-09-07T12:05:00.000Z', now)).toBe('just now');
  });
});

describe('searching the board', () => {
  const tasks = [
    task({ id: '1', kind: 'confirm_dish', neighbour: 'milo' }),
    task({ id: '2', kind: 'confirm_category', neighbour: 'penny' }),
    task({ id: '3', kind: 'milo_objective', neighbour: 'milo' }),
  ];

  it('matches the words a person can SEE', () => {
    expect(searchTasks(tasks, 'category').map((t) => t.id)).toEqual(['2']);
    expect(searchTasks(tasks, 'working toward').map((t) => t.id)).toEqual(['3']);
  });

  it('matches the neighbour by name', () => {
    expect(searchTasks(tasks, 'milo').map((t) => t.id)).toEqual(['1', '3']);
  });

  it('never matches the raw kind — nobody has read that string', () => {
    // Searching "confirm_dish" finding something would mean the search is
    // indexing an implementation detail.
    expect(searchTasks(tasks, 'confirm_dish')).toHaveLength(0);
  });

  it('an empty query is everything, not nothing', () => {
    expect(searchTasks(tasks, '   ')).toHaveLength(3);
  });

  it('ignores case', () => {
    expect(searchTasks(tasks, 'PENNY')).toHaveLength(1);
  });
});

describe('the count line', () => {
  it('counts in words a person would use', () => {
    expect(taskCountLine(0)).toBe('Nothing waiting');
    expect(taskCountLine(1)).toBe('1 task');
    expect(taskCountLine(11)).toBe('11 tasks');
  });
});


// C101 (4 Sep, founder) — the board manages STATUS; chat carries SUBSTANCE.
// Built 8 Sep with the schema slice; before that these chips were deliberately
// not faked, because a control that appears to work and does not is harder to
// find than one that is missing.
describe('C101 — the status row', () => {
  const tasks = [
    task({ id: '1', status: 'planned' }),
    task({ id: '2', status: 'planned' }),
    task({ id: '3', status: 'progress' }),
    task({ id: '4', status: 'done' }),
    task({ id: '5', status: 'declined' }),
  ];

  it('is exactly the four the drawing shows — reopened is a transition', () => {
    expect([...TASK_STATUSES]).toEqual(['planned', 'progress', 'done', 'declined']);
  });

  it('counts every chip, including the ones at zero', () => {
    // A row whose chips appear and vanish as you work is a row you cannot aim
    // at — the count goes to 0, the chip stays.
    expect(statusCounts(tasks)).toEqual({ all: 5, planned: 2, progress: 1, done: 1, declined: 1 });
    expect(statusCounts([])).toEqual({ all: 0, planned: 0, progress: 0, done: 0, declined: 0 });
  });

  it('filters to one status, and "all" keeps everything', () => {
    expect(filterByStatus(tasks, 'planned').map((t) => t.id)).toEqual(['1', '2']);
    expect(filterByStatus(tasks, 'all')).toHaveLength(5);
  });

  it('search also matches the status word a person can SEE', () => {
    // "In progress" is on screen, so typing it must find the row.
    expect(searchTasks(tasks, 'in progress').map((t) => t.id)).toEqual(['3']);
  });
});

describe('C101 — which moves the board offers', () => {
  it('never offers a move the server would refuse', () => {
    // The board cannot know a done task was really declined; claiming so would
    // be the board authoring substance, which C101 forbids.
    expect(nextStatuses('done')).toEqual(['planned']);
    expect(nextStatuses('declined')).toEqual(['planned']);
    expect(nextStatuses('done')).not.toContain('declined');
  });

  it('a live task can start, finish, or be refused', () => {
    expect(nextStatuses('planned')).toEqual(['progress', 'done', 'declined']);
    expect(nextStatuses('progress')).toContain('planned');
  });

  it('names the button for what it DOES, not for the status it lands on', () => {
    // "Planned" on a finished task reads as a category, not an action.
    expect(transitionLabel('done', 'planned')).toBe('Reopen');
    expect(transitionLabel('declined', 'planned')).toBe('Reopen');
    expect(transitionLabel('planned', 'progress')).toBe('Start');
    expect(transitionLabel('planned', 'declined')).toBe('Not doing this');
  });
});


describe('board calendar windows and composed filters', () => {
  const now = new Date('2026-09-18T17:00:00Z'); // 19 September, 01:00 in Singapore
  const opts = { range: 'today' as const, now, timezone: 'Asia/Singapore', status: 'all' as const, query: '' };
  const dated = [
    task({ id: 'today', asked_at: '2026-09-18T16:30:00Z', status: 'planned' }),
    task({ id: 'yesterday', asked_at: '2026-09-18T15:59:00Z', status: 'done' }),
    task({ id: 'old', asked_at: '2024-09-18T16:30:00Z', status: 'planned' }),
    task({ id: 'future', asked_at: '2026-09-19T16:30:00Z', status: 'declined' }),
    task({ id: 'invalid', asked_at: 'not-a-date' }),
  ];
  it('Today begins at anchored midnight, not 24 hours ago', () => {
    expect(boardView(dated, opts).shown.map(t => t.id)).toEqual(['today']);
  });
  it('Year excludes old years and future days', () => {
    expect(boardView(dated, { ...opts, range: 'year' }).shown.map(t => t.id)).toEqual(['today', 'yesterday']);
  });
  it('Custom includes both chosen calendar days and respects their timezone', () => {
    expect(boardView(dated, { ...opts, range: 'custom', custom: { from: '2026-09-18', to: '2026-09-19' } }).shown.map(t => t.id))
      .toEqual(['today', 'yesterday']);
    expect(boardView(dated, { ...opts, range: 'custom', custom: { from: '2026-09-19', to: '2026-09-18' } }).shown).toEqual([]);
  });
  it('status counts describe the date/search scope before a status is chosen', () => {
    const extra = task({ id: 'milo', neighbour: 'milo', asked_at: '2026-09-18T16:35:00Z' });
    const view = boardView([...dated, extra], { ...opts, range: 'week', status: 'done', query: 'Penny' });
    expect(view.shown.map(t => t.id)).toEqual(['yesterday']);
    expect(view.counts).toEqual({ all: 2, planned: 1, progress: 0, done: 1, declined: 0 });
  });
});

it('C75 uses Monday, month start and January 1 for calendar ranges', () => {
  const opts = { now: new Date('2026-09-18T17:00:00Z'), timezone: 'Asia/Singapore', status: 'all' as const, query: '' };
  const dates = ['2025-12-31', '2026-01-01', '2026-08-31', '2026-09-01', '2026-09-13', '2026-09-14', '2026-09-19'];
  const rows = dates.map(day => task({ id: day, asked_at: `${day}T02:00:00Z` }));
  expect(boardView(rows, { ...opts, range: 'week' }).shown.map(t => t.id)).toEqual(['2026-09-14', '2026-09-19']);
  expect(boardView(rows, { ...opts, range: 'month' }).shown.map(t => t.id)).toEqual(['2026-09-01', '2026-09-13', '2026-09-14', '2026-09-19']);
  expect(boardView(rows, { ...opts, range: 'year' }).shown.map(t => t.id)).toEqual(dates.slice(1));
});

it('groups visible tasks in drawn status order while retaining order within each group', () => {
  const tasks = [task({id:'done',status:'done'}),task({id:'planned-1'}),task({id:'progress',status:'progress'}),task({id:'declined',status:'declined'}),task({id:'planned-2'})];
  const result = boardView(tasks, {range:'today',now:new Date('2026-09-07T12:00:00Z'),timezone:'UTC',status:'all',query:''});
  expect(result.shown.map(t => t.id)).toEqual(['progress','planned-1','planned-2','done','declined']);
  expect(tasks.map(t => t.id)).toEqual(['done','planned-1','progress','declined','planned-2']);
  expect(result.counts).toEqual({all:5,planned:2,progress:1,done:1,declined:1});
});
