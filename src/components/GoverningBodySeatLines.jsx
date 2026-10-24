import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ConfirmDialog from './ui/ConfirmDialog';
import { governingBodyService } from '../services/governingBodyService';
import { useT } from '../i18n/LanguageContext';
import { bodyApplicationErrorMessage } from '../i18n/apiError';
import { seatLinesOf } from '../views/Role/bodyApplication';

/*
  Being an admin of a Governing Body that exists (backend 3d7d05a, governing-body
  ticket 04; owner 2026-10-24): under the cards on /select-role and in My Profile's
  "Sekolah lain", the way in - "Punya kode yayasan?" and a link to
  /get-started/governing-body-admin - and each body's newest outcome from
  `GET /governing-body-applications/mine` (`seatLinesOf`): waiting, with a way to
  take it back; turned down by the senior admin, with the reason; or removed, with
  the reason. An approved one is a place, listed with the schools.

  The caller shows it only to somebody who is no student anywhere (`mayJoinAnother`),
  as the server refuses a student. A read that fails leaves the link.
*/
export const GoverningBodySeatLines = ({ className = '' }) => {
  const { t } = useT();
  const [lines, setLines] = useState([]);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    () =>
      governingBodyService
        .listMySeats()
        .then((seats) => setLines(seatLinesOf(seats)))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await governingBodyService.cancelApplication(cancelling.id);
    } catch (err) {
      setError(bodyApplicationErrorMessage(err, t));
    } finally {
      await load();
      setBusy(false);
      setCancelling(null);
    }
  };

  return (
    <div className={`text-xs font-semibold leading-relaxed text-left space-y-2 ${className}`}>
      {lines.map((line) => (
        <div key={line.id} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`break-words ${line.state === 'WAITING' ? 'text-amber-700' : 'text-rose-700'}`}>{t(`gbapp.line.${line.state}`, { name: line.name })}</p>
            {line.reason && <p className="text-slate-600 break-words mt-0.5">{t('others.reason', { reason: line.reason })}</p>}
          </div>
          {line.state === 'WAITING' && (
            <button
              type="button"
              onClick={() => setCancelling(line)}
              className="shrink-0 font-extrabold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
            >
              {t('others.cancel')}
            </button>
          )}
        </div>
      ))}
      {error && (
        <p className="text-rose-700" role="alert">
          {error}
        </p>
      )}
      <p className="text-slate-500">
        {t('gbapp.line.question')}{' '}
        <Link
          to="/get-started/governing-body-admin"
          className="font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          {t('gbapp.line.link')}
        </Link>
      </p>

      <ConfirmDialog
        open={Boolean(cancelling)}
        tone="danger"
        title={t('gbapp.cancel.title')}
        body={cancelling ? t('gbapp.cancel.body', { name: cancelling.name }) : ''}
        confirmLabel={t('selectRole.cancel.confirm')}
        cancelLabel={t('selectRole.cancel.keep')}
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={() => setCancelling(null)}
        onConfirm={cancel}
      />
    </div>
  );
};

export default GoverningBodySeatLines;
