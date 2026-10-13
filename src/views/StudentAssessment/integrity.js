/*
  An attempt's integrity signals (backend b5db324/265aa9d, assessment ticket 06;
  owner 2026-10-13). On a KUIS, UTS or UAS answered online (`integritySignals`
  on the assessment), the attempt page reports, through POST /tracking/events:

  - assessment.focus_lost - the student left the page: another tab or app, or
    another window. One leave is one signal, however many browser events it
    fires (blur, then the tab hidden), until they come back.
  - assessment.fullscreen_exited - fullscreen left while still on the page (Esc).
    The student is asked to enter it at the start. A leave usually ends
    fullscreen too; that is the one leave, not a second signal, so a fullscreen
    exit is counted only if the student is still here a moment later.
  - assessment.pasted / assessment.copied - each one (a cut counts as a copy).

  Out of fullscreen the questions are locked (owner 2026-10-13, after seeing
  that Esc changed nothing for the student): hidden until the student goes back,
  the clock running and "Kumpulkan" still open. A page cannot forbid Esc - the
  browser owns it - so locking is as far as it goes. Never where the browser has
  no fullscreen (an iPhone), which could never unlock (`questionsLocked`).

  Not a leave: the essay's file picker (it takes focus from the window), and
  anything after the attempt ended - handed in, closed by time - which the server
  would refuse anyway. Advisory: counted for the staff, never shown to the
  student as a count, never penalised (handoff #15).

  Pure: the browser events are wired in useIntegritySignals.js.
*/

export const SIGNAL = {
  focusLost: 'assessment.focus_lost',
  fullscreenExited: 'assessment.fullscreen_exited',
  pasted: 'assessment.pasted',
  copied: 'assessment.copied',
};

/**
 * Whether the questions are hidden now: the assessment records signals, this
 * browser can go fullscreen, it is not, and there is time left.
 */
export const questionsLocked = ({ signalled, supported, fullscreen, timeLeftMs }) =>
  Boolean(signalled && supported && !fullscreen && timeLeftMs > 0);

/* How long after a fullscreen exit to look whether it was really a leave. */
export const FULLSCREEN_SETTLE_MS = 300;

/**
 * @param record    (verb) => void, called once per signal
 * @param schedule  (fn, ms) => void, setTimeout by default
 */
export function createIntegrityGate(record, { schedule = (fn, ms) => setTimeout(fn, ms) } = {}) {
  let away = false;
  let picking = false;
  let ended = false;

  return {
    /** The page lost focus or was hidden. */
    left() {
      if (ended || away) return;
      away = true;
      if (!picking) record(SIGNAL.focusLost);
    },
    /** The page has focus again. */
    back() {
      away = false;
      picking = false;
    },
    /** The essay's file picker is about to open: the focus it takes is no leave. */
    picking() {
      picking = true;
    },
    /** The file picker closed (a file chosen, or cancelled). */
    picked() {
      picking = false;
    },
    fullscreenExited() {
      if (ended || picking) return;
      schedule(() => {
        if (!ended && !away && !picking) record(SIGNAL.fullscreenExited);
      }, FULLSCREEN_SETTLE_MS);
    },
    pasted() {
      if (!ended) record(SIGNAL.pasted);
    },
    copied() {
      if (!ended) record(SIGNAL.copied);
    },
    /** The attempt is ending (handing in, closed): nothing more counts. */
    end() {
      ended = true;
    },
    /** Handing in failed: the attempt goes on. */
    resume() {
      ended = false;
    },
  };
}
