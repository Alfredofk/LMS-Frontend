import { describe, expect, it } from 'vitest';

import {
  answerBody,
  answeredCount,
  attemptState,
  choose,
  clockText,
  countsDown,
  draftChanged,
  draftError,
  draftOf,
  essayFileError,
  isAnswered,
  keyOf,
  outlinePhase,
  remainingMs,
  startState,
  studentStateOf,
} from './studentAssessment';

// Against backend assessment.submission.js (6380e3e, 5255842, 1e6c749) and assessment.schema.js answerBody.

const assessment = { status: 'PUBLISHED', mode: 'ONLINE', opensAt: '2026-10-12T00:30:00Z', closesAt: '2026-10-13T16:59:00Z', questionCount: 2 };
const before = new Date('2026-10-11T00:00:00Z');
const during = new Date('2026-10-12T05:00:00Z');
const after = new Date('2026-10-14T00:00:00Z');

describe('the outline', () => {
  it('its phase, on the student own window', () => {
    expect(outlinePhase(assessment, before)).toBe('NOT_OPEN');
    expect(outlinePhase(assessment, during)).toBe('OPEN');
    expect(outlinePhase(assessment, after)).toBe('CLOSED');
    expect(outlinePhase({ ...assessment, status: 'CANCELLED' }, during)).toBe('CANCELLED');
    expect(outlinePhase({ ...assessment, mode: 'OFFLINE' }, during)).toBe('OFFLINE');
  });

  it('the student word: not open, open, closed, cancelled - offline ones by their window too', () => {
    expect(studentStateOf(assessment, before)).toBe('NOT_OPEN');
    expect(studentStateOf(assessment, during)).toBe('OPEN');
    expect(studentStateOf(assessment, after)).toBe('CLOSED');
    expect(studentStateOf({ ...assessment, mode: 'OFFLINE' }, during)).toBe('OPEN');
    expect(studentStateOf({ ...assessment, status: 'CANCELLED' }, before)).toBe('CANCELLED');
  });

  it('continue beats start; the server canStart decides; a reason when neither', () => {
    const outline = (over) => ({ assessment, attemptsLeft: 1, inProgressId: null, canStart: false, ...over });
    expect(startState(outline({ inProgressId: 's1', canStart: false }), during)).toEqual({ action: 'continue', why: null });
    expect(startState(outline({ canStart: true }), after)).toEqual({ action: 'start', why: null });
    expect(startState(outline({}), before).why).toBe('notOpen');
    expect(startState(outline({ attemptsLeft: 0 }), during).why).toBe('noAttempts');
    expect(startState(outline({}), after).why).toBe('closed');
    expect(startState(outline({ assessment: { ...assessment, questionCount: 0 } }), during).why).toBe('noQuestions');
    expect(startState(outline({ assessment: { ...assessment, status: 'CANCELLED' } }), during).why).toBe('cancelled');
    expect(startState(outline({ assessment: { ...assessment, mode: 'OFFLINE' } }), during).why).toBe('offline');
  });

  it('an attempt row: in progress, void, released or waiting', () => {
    expect(attemptState({ status: 'IN_PROGRESS' })).toBe('IN_PROGRESS');
    expect(attemptState({ status: 'VOID', released: false })).toBe('VOID');
    expect(attemptState({ status: 'SUBMITTED', released: true })).toBe('RELEASED');
    expect(attemptState({ status: 'SUBMITTED', released: false })).toBe('WAITING');
  });
});

const mcq = (scoring, optionIds = []) => ({ id: 'm', kind: 'MCQ', mcqScoring: scoring, options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], answer: optionIds.length ? { optionIds } : null });
const tf = (value) => ({ id: 't', kind: 'TF', answer: value === undefined ? null : { value } });
const short = (text) => ({ id: 's', kind: 'SHORT', answer: text === undefined ? null : { text } });
const essay = (text, file = null) => ({ id: 'e', kind: 'ESSAY', answer: text === undefined && !file ? null : { text: text ?? null, file } });

describe('answers', () => {
  it('drafts read back what was saved', () => {
    expect(draftOf(mcq('PARTIAL', ['b']))).toEqual(['b']);
    expect(draftOf(mcq('SINGLE'))).toEqual([]);
    expect(draftOf(tf(false))).toBe(false);
    expect(draftOf(tf())).toBeNull();
    expect(draftOf(short())).toBe('');
    expect(draftOf(essay(null))).toBe('');
  });

  it('answered: something chosen, a value, text, or an essay file', () => {
    expect(isAnswered(mcq('SINGLE'), [])).toBe(false);
    expect(isAnswered(mcq('SINGLE'), ['a'])).toBe(true);
    expect(isAnswered(tf(), false)).toBe(true);
    expect(isAnswered(tf(), null)).toBe(false);
    expect(isAnswered(short(), '   ')).toBe(false);
    expect(isAnswered(essay(null, { name: 'x.pdf' }), '')).toBe(true);
    expect(answeredCount([short('5'), tf()], { t: true })).toBe(2);
  });

  it('SINGLE takes one, the others toggle', () => {
    expect(choose(mcq('SINGLE'), ['a'], 'b')).toEqual(['b']);
    expect(choose(mcq('SINGLE'), ['a'], 'a')).toEqual(['a']);
    expect(choose(mcq('PARTIAL'), ['a'], 'b')).toEqual(['a', 'b']);
    expect(choose(mcq('ALL_OR_NOTHING'), ['a', 'b'], 'a')).toEqual(['b']);
  });

  it('one field per kind; empty text clears', () => {
    expect(answerBody(mcq('PARTIAL'), ['a', 'c'])).toEqual({ optionIds: ['a', 'c'] });
    expect(answerBody(tf(), true)).toEqual({ value: true });
    expect(answerBody(tf(), null)).toEqual({ value: null });
    expect(answerBody(short(), '  ')).toEqual({ text: null });
    expect(answerBody(short(), ' lima ')).toEqual({ text: ' lima ' });
  });

  it('changed against the saved answer, order of choices aside', () => {
    expect(draftChanged(mcq('PARTIAL', ['a', 'b']), ['b', 'a'])).toBe(false);
    expect(draftChanged(mcq('PARTIAL', ['a']), ['a', 'b'])).toBe(true);
    expect(draftChanged(tf(true), true)).toBe(false);
    expect(draftChanged(short(), '')).toBe(false);
    expect(draftChanged(short(), '  ')).toBe(false);
    expect(draftChanged(short('5'), '5 ')).toBe(true);
  });

  it('lengths and files as the server takes them', () => {
    expect(draftError(short(), 'x'.repeat(200))).toBeNull();
    expect(draftError(short(), 'x'.repeat(201))).toBe('shortLong');
    expect(draftError(essay(''), 'x'.repeat(20_001))).toBe('essayLong');
    expect(essayFileError({ name: 'Jawaban.PDF', size: 10 * 1024 * 1024 })).toBeNull();
    expect(essayFileError({ name: 'a.pdf', size: 10 * 1024 * 1024 + 1 })).toBe('fileSize');
    expect(essayFileError({ name: 'a.docm', size: 10 })).toBe('fileType');
  });
});

describe('the clock', () => {
  it('counts down under a day, never below zero', () => {
    const now = new Date('2026-10-12T05:00:00Z');
    expect(remainingMs('2026-10-12T04:00:00Z', now)).toBe(0);
    expect(clockText(45 * 60 * 1000 + 7000)).toBe('45:07');
    expect(clockText(3600 * 1000 + 2 * 60 * 1000 + 9000)).toBe('1:02:09');
    expect(clockText(500)).toBe('00:01');
    expect(countsDown('2026-10-13T04:59:59Z', now)).toBe(true);
    expect(countsDown('2026-10-13T05:00:00Z', now)).toBe(false);
  });
});

describe('the key once released', () => {
  it('letters in the order shown, the value, the accepted answers; none for an essay or when hidden', () => {
    expect(keyOf({ kind: 'MCQ', options: [{ id: 'c' }, { id: 'a' }, { id: 'b' }], key: { correctOptionIds: ['a', 'b'] } })).toEqual({ kind: 'MCQ', letters: ['B', 'C'] });
    expect(keyOf({ kind: 'TF', key: { value: false } })).toEqual({ kind: 'TF', value: false });
    expect(keyOf({ kind: 'SHORT', key: { accepted: ['5', 'lima'] } })).toEqual({ kind: 'SHORT', accepted: ['5', 'lima'] });
    expect(keyOf({ kind: 'ESSAY', key: null })).toBeNull();
    expect(keyOf({ kind: 'TF', key: null })).toBeNull();
  });
});
