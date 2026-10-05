import { describe, expect, it } from 'vitest';

import { MAX_BATCH, createTracker, readingMs, tenthOf } from './tracker.js';

const fixedNow = () => new Date('2026-10-04T05:00:00Z');

describe('readingMs - about a second per 50 words, 3 s to 60 s', () => {
  it('counts words, not tags', () => {
    expect(readingMs('<p>' + 'kata '.repeat(500) + '</p>')).toBe(10_000);
  });
  it('is never under 3 s or over a minute', () => {
    expect(readingMs('<p>Halo</p>')).toBe(3_000);
    expect(readingMs('kata '.repeat(10_000))).toBe(60_000);
    expect(readingMs(null)).toBe(3_000);
  });
});

describe('tenthOf - as tracking.record.js counts', () => {
  it('floors, and caps a position past the end at 10', () => {
    expect(tenthOf(59, 600)).toBe(0);
    expect(tenthOf(60, 600)).toBe(1);
    expect(tenthOf(650, 600)).toBe(10);
  });
});

describe('createTracker', () => {
  it('queues each one-off verb once per content, with the device time', async () => {
    const sent = [];
    const tracker = createTracker({ send: async (events) => sent.push(events), now: fixedNow });
    expect(tracker.opened('c1')).toBe(true);
    expect(tracker.opened('c1')).toBe(false);
    tracker.readToEnd('c1');
    tracker.linkClicked('c2');
    tracker.linkClicked('c2');
    await tracker.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      { verb: 'content.opened', contentId: 'c1', occurredAt: '2026-10-04T05:00:00.000Z' },
      { verb: 'content.text_read_to_end', contentId: 'c1', occurredAt: '2026-10-04T05:00:00.000Z' },
      { verb: 'content.link_clicked', contentId: 'c2', occurredAt: '2026-10-04T05:00:00.000Z' },
    ]);
  });

  it('queues a video only at a new tenth, and never a bad duration', () => {
    const tracker = createTracker({ send: async () => {} , now: fixedNow });
    expect(tracker.video('v', 30, 600)).toBe(false); // tenth 0
    expect(tracker.video('v', 61, 600)).toBe(true); // 1
    expect(tracker.video('v', 100, 600)).toBe(false); // still 1
    expect(tracker.video('v', 490, 600)).toBe(true); // 8, skipping is fine
    expect(tracker.video('v', 300, 600)).toBe(false); // back
    expect(tracker.video('w', 10, 0)).toBe(false);
    expect(tracker.video('w', 10, 90_000)).toBe(false);
    expect(tracker.pending()).toBe(2);
  });

  it('sends at most 50 at once', async () => {
    const sizes = [];
    const tracker = createTracker({ send: async (events) => sizes.push(events.length), now: fixedNow });
    for (let n = 0; n < MAX_BATCH + 7; n += 1) tracker.opened(`c${n}`);
    await tracker.flush();
    expect(sizes).toEqual([50, 7]);
  });

  it('keeps a batch that failed on the network for the next flush', async () => {
    let fail = true;
    const sent = [];
    const tracker = createTracker({
      send: async (events) => {
        if (fail) throw new TypeError('Failed to fetch');
        sent.push(events);
      },
      now: fixedNow,
    });
    tracker.opened('c1');
    await tracker.flush();
    expect(tracker.pending()).toBe(1);
    fail = false;
    await tracker.flush();
    expect(sent).toHaveLength(1);
    expect(tracker.pending()).toBe(0);
  });

  it('drops a batch the server refused as a whole (4xx)', async () => {
    const tracker = createTracker({
      send: async () => {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      },
      now: fixedNow,
    });
    tracker.opened('c1');
    await tracker.flush();
    expect(tracker.pending()).toBe(0);
  });

  it('runs one flush at a time', async () => {
    let calls = 0;
    let release;
    const tracker = createTracker({
      send: () => {
        calls += 1;
        return new Promise((resolve) => (release = resolve));
      },
      now: fixedNow,
    });
    tracker.opened('c1');
    const a = tracker.flush();
    const b = tracker.flush();
    release();
    await Promise.all([a, b]);
    expect(calls).toBe(1);
  });

  it('reports each accepted event to onProgress, with completed, and nothing for a refused one', async () => {
    const heard = [];
    const tracker = createTracker({
      send: async () => ({
        results: [
          { index: 0, ok: true, recorded: true, completed: false },
          { index: 1, ok: true, recorded: true, completed: true },
          { index: 2, ok: false, error: { code: 'NOT_FOUND' } },
        ],
      }),
      now: fixedNow,
      onProgress: (contentId, update) => heard.push([contentId, update]),
    });
    tracker.opened('c1');
    tracker.readToEnd('c2');
    tracker.linkClicked('gone');
    await tracker.flush();
    expect(heard).toEqual([
      ['c1', { completed: false }],
      ['c2', { completed: true }],
    ]);
  });

  it('reports nothing when the batch failed, and a fetched file as completed', async () => {
    const heard = [];
    const tracker = createTracker({
      send: async () => {
        throw new TypeError('Failed to fetch');
      },
      now: fixedNow,
      onProgress: (contentId, update) => heard.push([contentId, update]),
    });
    tracker.opened('c1');
    await tracker.flush();
    expect(heard).toEqual([]);
    tracker.fileFetched('f1');
    expect(heard).toEqual([['f1', { completed: true }]]);
  });

  it('listen swaps who hears, and its stop leaves a later listener alone', () => {
    const a = [];
    const b = [];
    const tracker = createTracker({ send: async () => {}, now: fixedNow });
    const stopA = tracker.listen((id) => a.push(id));
    tracker.fileFetched('f1');
    tracker.listen((id) => b.push(id));
    stopA();
    tracker.fileFetched('f2');
    expect(a).toEqual(['f1']);
    expect(b).toEqual(['f2']);
  });
});
