import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { createTracker } from '../../components/content/tracker';
import { trackingService } from '../../services/trackingService';
import { createIntegrityGate } from './integrity';

/*
  The browser half of an attempt's integrity signals (integrity.js has the
  rules). While `enabled` - the assessment records them and the attempt is in
  progress - it listens for leaving the page, fullscreen left, copy and paste,
  and sends each signal through the learning-event queue (tracker.js): every 8 s,
  at once when the page is hidden (keepalive), and before handing in.

  `fullscreen` says whether this browser can go fullscreen (an iPhone cannot:
  then nothing is asked and no exit is counted) and whether it is now; `enter`
  must run inside a click. A reload or closing the tab is not a leave
  (beforeunload holds the gate for a second).
*/

const FLUSH_MS = 8_000;

/* Attempt pages listening now. Leaving fullscreen waits a tick and checks it, so
   StrictMode's mount-unmount-mount in development does not drop it on arrival. */
let listening = 0;

const fullscreenSupported = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
const isFullscreen = () => typeof document !== 'undefined' && Boolean(document.fullscreenElement);

/** Fullscreen for the whole page, from a click; a refusal is ignored. */
/* Whether the page is fullscreen now, read as React reads any outside store. */
const subscribeFullscreen = (onChange) => {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
};

export function enterFullscreen() {
  if (!fullscreenSupported() || isFullscreen()) return;
  document.documentElement.requestFullscreen().catch(() => {});
}

export function leaveFullscreen() {
  if (isFullscreen()) document.exitFullscreen().catch(() => {});
}

export function useIntegritySignals({ enabled, submissionId }) {
  const [tracker] = useState(() => createTracker({ send: (events, options) => trackingService.send(events, options) }));
  const gateRef = useRef(null);
  const active = useSyncExternalStore(subscribeFullscreen, isFullscreen);
  const supported = fullscreenSupported();

  useEffect(() => {
    if (!enabled) return undefined;
    const gate = createIntegrityGate((verb) => tracker.signal(verb, submissionId));
    gateRef.current = gate;
    let unloading = false;
    let unloadTimer;

    const flushAway = () => tracker.flush({ keepalive: true }).catch(() => {});
    const onBlur = () => !unloading && gate.left();
    const onFocus = () => gate.back();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (!unloading) gate.left();
        flushAway();
      } else if (document.hasFocus()) gate.back();
    };
    const onFullscreen = () => !isFullscreen() && gate.fullscreenExited();
    const onBeforeUnload = () => {
      unloading = true;
      clearTimeout(unloadTimer);
      unloadTimer = setTimeout(() => (unloading = false), 1000);
    };
    const onPaste = () => gate.pasted();
    const onCopy = () => gate.copied();

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', flushAway);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('paste', onPaste);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    const timer = setInterval(() => tracker.flush().catch(() => {}), FLUSH_MS);
    listening += 1;

    return () => {
      gate.end();
      gateRef.current = null;
      clearInterval(timer);
      clearTimeout(unloadTimer);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', flushAway);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      flushAway();
      /* The attempt page is gone (handed in, closed, or the student moved away): fullscreen was only for it. */
      listening -= 1;
      setTimeout(() => listening === 0 && leaveFullscreen(), 0);
    };
  }, [enabled, submissionId, tracker]);

  /** Before handing in: stop counting and send what waits, while the attempt still takes it. */
  const finish = useCallback(async () => {
    gateRef.current?.end();
    await tracker.flush().catch(() => {});
  }, [tracker]);

  /** Handing in failed: the attempt goes on, and so does the counting. */
  const resume = useCallback(() => gateRef.current?.resume(), []);

  /* The essay's file picker takes focus from the window; that is no leave. */
  const picking = useCallback(() => gateRef.current?.picking(), []);
  const picked = useCallback(() => gateRef.current?.picked(), []);

  return { fullscreen: { supported, active, enter: enterFullscreen }, finish, resume, picking, picked };
}
