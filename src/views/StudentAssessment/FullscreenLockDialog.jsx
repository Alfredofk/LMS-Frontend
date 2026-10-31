import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize } from 'lucide-react';

import ModalHeading from '../../components/ui/ModalHeading';
import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';

/*
  Over an attempt left out of fullscreen (owner 2026-10-13): the page behind is
  blurred, and the one way on is back to fullscreen. "Kumpulkan sekarang" stays,
  so a student whose browser refuses fullscreen is never stuck. Escape and the
  backdrop do nothing - Escape is what left fullscreen in the first place. The
  attempt page makes what is behind inert while this is open.

  `facts` (since 2026-10-29, mockup mengerjakan-penilaian.html item 9) are the
  time left and the questions answered, already translated, as eyebrow cells:
  the clock keeps running behind the blur.
*/
export const FullscreenLockDialog = ({ facts = [], onBack, onHandIn }) => {
  const { t } = useT();
  const backRef = useRef(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fullscreen-lock-title"
        aria-describedby="fullscreen-lock-body"
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading
          tone="brand"
          icon={Maximize}
          titleId="fullscreen-lock-title"
          title={t('sasm.fullscreen.title')}
          bodyId="fullscreen-lock-body"
          body={t('sasm.fullscreen.body')}
        />
        {facts.length > 0 && (
          <dl className="flex flex-wrap gap-x-7 gap-y-2 sm:pl-[60px]">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{fact.label}</dt>
                <dd className="text-[15px] font-extrabold text-slate-900 tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={modalActions}>
          <button type="button" onClick={onHandIn} className={modalCancelClass()}>
            {t('sasm.fullscreen.handInNow')}
          </button>
          <button ref={backRef} type="button" onClick={onBack} className={modalConfirmClass('brand')}>
            {t('sasm.fullscreen.back')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FullscreenLockDialog;
