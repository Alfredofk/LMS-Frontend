import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ConfirmDialog from './ui/ConfirmDialog';
import { principalApplicationService } from '../services/principalApplicationService';
import { useT } from '../i18n/LanguageContext';
import { principalApplicationErrorMessage } from '../i18n/apiError';
import { principalLinesOf } from '../views/Role/principalApplication';

/*
  Applying to be the Principal of a Governing Body's School (backend e206bd9,
  governing-body ticket 06; owner 2026-10-26, A4): under the cards on /select-role and
  in My Profile's "Sekolah lain", beside the foundation lines - the way in, "Diminta
  yayasan menjadi Kepala Sekolah?" and a link to /get-started/principal, and each
  School's newest outcome from `GET /principal-applications/mine` (`principalLinesOf`):
  waiting, with a way to take it back; turned down, with the reason; or closed because
  another applicant was approved. An approved one is a place, listed with the schools.

  The caller shows it only to somebody who is no student anywhere (`mayJoinAnother`),
  as the server refuses a student. A read that fails leaves the link.
*/
export const PrincipalApplicationLines = ({ className = '' }) => {
  const { t } = useT();
  const [lines, setLines] = useState([]);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    () =>
      principalApplicationService
        .listMine()
        .then((applications) => setLines(principalLinesOf(applications)))
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
      await principalApplicationService.cancel(cancelling.id);
    } catch (err) {
      setError(principalApplicationErrorMessage(err, t));
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
            <p className={`break-words ${line.state === 'WAITING' ? 'text-amber-700' : 'text-rose-700'}`}>{t(`pa.line.${line.state}`, { name: line.name })}</p>
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
        {t('pa.line.question')}{' '}
        <Link
          to="/get-started/principal"
          className="font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          {t('pa.line.link')}
        </Link>
      </p>

      <ConfirmDialog
        open={Boolean(cancelling)}
        tone="danger"
        title={t('pa.cancel.title')}
        body={cancelling ? t('pa.cancel.body', { name: cancelling.name }) : ''}
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

export default PrincipalApplicationLines;
