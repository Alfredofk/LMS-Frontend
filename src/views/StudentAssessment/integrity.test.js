import { describe, expect, it } from 'vitest';

import { FULLSCREEN_SETTLE_MS, SIGNAL, createIntegrityGate, questionsLocked } from './integrity';

/* A gate whose recorded verbs and scheduled checks are in hand. */
const setup = () => {
  const recorded = [];
  const later = [];
  const gate = createIntegrityGate((verb) => recorded.push(verb), { schedule: (fn, ms) => later.push({ fn, ms }) });
  const settle = () => later.splice(0).forEach(({ fn }) => fn());
  return { gate, recorded, later, settle };
};

describe('integrity signals - one leave, one signal', () => {
  it('blur and then the tab hidden are one leave; coming back allows the next', () => {
    const { gate, recorded } = setup();
    gate.left();
    gate.left();
    gate.back();
    gate.left();
    expect(recorded).toEqual([SIGNAL.focusLost, SIGNAL.focusLost]);
  });

  it('the essay file picker is no leave, and is forgotten once it closes', () => {
    const { gate, recorded } = setup();
    gate.picking();
    gate.left();
    gate.back();
    gate.left();
    expect(recorded).toEqual([SIGNAL.focusLost]);
  });

  it('a picker closed without the window ever losing focus leaves nothing behind', () => {
    const { gate, recorded } = setup();
    gate.picking();
    gate.picked();
    gate.left();
    expect(recorded).toEqual([SIGNAL.focusLost]);
  });
});

describe('integrity signals - fullscreen', () => {
  it('left while staying on the page: counted, after the settle time', () => {
    const { gate, recorded, later, settle } = setup();
    gate.fullscreenExited();
    expect(recorded).toEqual([]);
    expect(later[0].ms).toBe(FULLSCREEN_SETTLE_MS);
    settle();
    expect(recorded).toEqual([SIGNAL.fullscreenExited]);
  });

  it('left because the student left the page: the leave only, either order', () => {
    const first = setup();
    first.gate.fullscreenExited();
    first.gate.left();
    first.settle();
    expect(first.recorded).toEqual([SIGNAL.focusLost]);

    const second = setup();
    second.gate.left();
    second.gate.fullscreenExited();
    second.settle();
    expect(second.recorded).toEqual([SIGNAL.focusLost]);
  });

  it('not while the file picker is open', () => {
    const { gate, recorded, settle } = setup();
    gate.picking();
    gate.fullscreenExited();
    settle();
    expect(recorded).toEqual([]);
  });
});

describe('integrity signals - copy, paste, and the end', () => {
  it('each copy and paste is its own signal', () => {
    const { gate, recorded } = setup();
    gate.copied();
    gate.pasted();
    gate.pasted();
    expect(recorded).toEqual([SIGNAL.copied, SIGNAL.pasted, SIGNAL.pasted]);
  });

  it('nothing counts once the attempt ends, a fullscreen exit already waiting included', () => {
    const { gate, recorded, settle } = setup();
    gate.fullscreenExited();
    gate.end();
    settle();
    gate.left();
    gate.copied();
    gate.pasted();
    gate.fullscreenExited();
    settle();
    expect(recorded).toEqual([]);
  });

  it('a failed hand-in resumes counting', () => {
    const { gate, recorded } = setup();
    gate.end();
    gate.resume();
    gate.pasted();
    expect(recorded).toEqual([SIGNAL.pasted]);
  });
});

describe('questions locked outside fullscreen (owner 2026-10-13)', () => {
  const base = { signalled: true, supported: true, fullscreen: false, timeLeftMs: 60_000 };
  it('locked out of fullscreen on an assessment that records signals', () => {
    expect(questionsLocked(base)).toBe(true);
  });
  it('open in fullscreen, on one that records none, where the browser has no fullscreen, and once time is up', () => {
    expect(questionsLocked({ ...base, fullscreen: true })).toBe(false);
    expect(questionsLocked({ ...base, signalled: false })).toBe(false);
    expect(questionsLocked({ ...base, supported: false })).toBe(false);
    expect(questionsLocked({ ...base, timeLeftMs: 0 })).toBe(false);
  });
});
