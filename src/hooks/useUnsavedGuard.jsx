import React, { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useT } from '../i18n/LanguageContext';

/*
  Holding a page while it has unsaved changes (owner, 2026-10-08): the
  assessment page and the question editor, where a teacher could lose a form
  to a menu click, the navbar's back button or the browser's Back.

  - Inside the app, React Router's useBlocker holds the move (the app has been a
    data router since 2026-10-08, App.jsx) and the app's own dialog asks:
    stay, or leave and lose the changes.
  - Closing or reloading the tab gets the browser's own prompt (beforeunload):
    a page may only ask for it, never word it.
  - A move the page makes itself after saving or on purpose (Cancel, a draft
    deleted) is let through with `release()` first, so a save never asks
    "leave without saving?".
  - Moving within the same page (only its query changing) is not held.

  const guard = useUnsavedGuard(dirty);
  ... guard.release(); navigate(...);
  ... {guard.dialog}
*/
export function useUnsavedGuard(dirty) {
  const { t } = useT();
  const released = useRef(false);

  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) => dirty && !released.current && currentLocation.pathname !== nextLocation.pathname,
    [dirty]
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      if (released.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  /* Changes made again after a release are held again. */
  useEffect(() => {
    if (dirty) released.current = false;
  }, [dirty]);

  const release = useCallback(() => {
    released.current = true;
  }, []);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      tone="danger"
      title={t('unsaved.title')}
      body={t('unsaved.body')}
      confirmLabel={t('unsaved.leave')}
      cancelLabel={t('unsaved.stay')}
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );

  return { release, dialog };
}

export default useUnsavedGuard;
