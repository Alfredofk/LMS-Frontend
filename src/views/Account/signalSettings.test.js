import { describe, expect, it } from 'vitest';

import { BUILT_IN, backToBuiltIn, signalBody, signalDraftErrors, signalDraftOf, typed } from './signalSettings';

/* GET /dashboard/signal-settings, as dashboard.settings.js settingsView shapes it. */
const read = (over = {}, updatedAt = null) => ({
  ...Object.fromEntries(Object.entries(BUILT_IN).map(([key, value]) => [key, { value, source: 'BUILT_IN' }])),
  ...over,
  updatedAt,
});

describe('BUILT_IN - dashboard.settings.js BUILT_IN', () => {
  it('restates the server\'s built-in thresholds', () => {
    expect(BUILT_IN).toEqual({
      absenceCount: 3,
      absenceWindowDays: 14,
      contentBehindPercent: 50,
      contentBehindMinPublished: 4,
      notSubmittedCount: 2,
      inactiveDays: 7,
    });
  });
});

describe('signalDraftErrors - dashboard.schema.js threshold() bounds', () => {
  const draftWith = (key, text) => typed(signalDraftOf(read()), key, text);

  it('takes a whole number at both ends of its bounds', () => {
    expect(signalDraftErrors(draftWith('absenceCount', '1'))).toEqual({});
    expect(signalDraftErrors(draftWith('absenceCount', '30'))).toEqual({});
    expect(signalDraftErrors(draftWith('contentBehindPercent', '100'))).toEqual({});
  });

  it('refuses 0, one past the top, a decimal and an empty box', () => {
    expect(signalDraftErrors(draftWith('absenceCount', '0')).absenceCount).toEqual({ key: 'signal.error.range', vars: { min: 1, max: 30 } });
    expect(signalDraftErrors(draftWith('absenceCount', '31')).absenceCount).toBeDefined();
    expect(signalDraftErrors(draftWith('notSubmittedCount', '21')).notSubmittedCount).toEqual({ key: 'signal.error.range', vars: { min: 1, max: 20 } });
    expect(signalDraftErrors(draftWith('inactiveDays', '7.5')).inactiveDays).toBeDefined();
    expect(signalDraftErrors(draftWith('inactiveDays', ' ')).inactiveDays).toBeDefined();
  });

  it('does not check a box going back to the built-in value', () => {
    const settings = read({ inactiveDays: { value: 10, source: 'SCHOOL' } });
    const draft = backToBuiltIn(typed(signalDraftOf(settings), 'inactiveDays', 'x'), 'inactiveDays');
    expect(signalDraftErrors(draft)).toEqual({});
  });
});

describe('signalBody - what PUT sends', () => {
  it('only what changed, with the updatedAt read (null before the first save)', () => {
    const settings = read();
    expect(signalBody(settings, typed(signalDraftOf(settings), 'absenceCount', '4'))).toEqual({ absenceCount: 4, updatedAt: null });
  });

  it('nothing when nothing changed, even typing the value that already applies', () => {
    const settings = read({ absenceCount: { value: 5, source: 'SCHOOL' } }, '2026-10-27T03:00:00.000Z');
    expect(signalBody(settings, signalDraftOf(settings))).toBeNull();
    expect(signalBody(settings, typed(signalDraftOf(settings), 'absenceCount', ' 5 '))).toBeNull();
    expect(signalBody(settings, typed(signalDraftOf(settings), 'inactiveDays', '7'))).toBeNull();
  });

  it('a school value going back is null; a built-in one has nothing to go back from', () => {
    const settings = read({ inactiveDays: { value: 10, source: 'SCHOOL' } }, '2026-10-27T03:00:00.000Z');
    const draft = backToBuiltIn(signalDraftOf(settings), 'inactiveDays');
    expect(draft.inactiveDays).toEqual({ text: '7', reset: true });
    expect(signalBody(settings, draft)).toEqual({ inactiveDays: null, updatedAt: '2026-10-27T03:00:00.000Z' });
    expect(signalBody(read(), backToBuiltIn(signalDraftOf(read()), 'inactiveDays'))).toBeNull();
  });

  it('typing after "Pakai bawaan" sends the number, not null', () => {
    const settings = read({ inactiveDays: { value: 10, source: 'SCHOOL' } }, '2026-10-27T03:00:00.000Z');
    const draft = typed(backToBuiltIn(signalDraftOf(settings), 'inactiveDays'), 'inactiveDays', '12');
    expect(signalBody(settings, draft)).toEqual({ inactiveDays: 12, updatedAt: '2026-10-27T03:00:00.000Z' });
  });
});
