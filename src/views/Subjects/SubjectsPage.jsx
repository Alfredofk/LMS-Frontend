import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import SubjectBoard from './SubjectBoard';
import TeachingQueue from './TeachingQueue';
import SubjectCatalog from './SubjectCatalog';
import { academicsService } from '../../services/academicsService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage } from '../../i18n/apiError';
import { SUBJECT_TABS } from './subjects';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';

/*
  Subjects — the Principal's page (owner, 2026-09-26), backend `89d1fc1`,
  ticket 08. Three tabs:

  - **Board**: one semester, every class, who teaches what; the Principal can
    assign a teacher directly (SubjectBoard).
  - **Waiting**: teachers asking to teach a subject in a class, to approve
    (one or many) or reject with a reason (TeachingQueue).
  - **Catalog**: the national subjects and the school's local ones, where a
    local one is added (SubjectCatalog).

  What each needs is fetched once here — the years (for the board's semesters),
  the catalog (for the board's "assign" and the catalog tab) and the queue (for
  its count) — each on its own, so one failing leaves the others on screen. The
  teacher list is fetched only when "assign" is first opened.

  The teacher's side — asking to teach — is the next slice, on "My classes".
*/
export const SubjectsPage = () => {
  const { showToast } = useOutletContext();
  const { membership } = useAuth();
  const { t } = useT();

  const [tab, setTab] = useState('BOARD');
  const [years, setYears] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [queue, setQueue] = useState(null);
  const [teachers, setTeachers] = useState(null);
  const [errors, setErrors] = useState({});
  const [notBuilt, setNotBuilt] = useState(false);

  const fail = useCallback(
    (what) => (err) => {
      /* A backend from before 89d1fc1 answers the catch-all 404; a missing
         semester or class is a 404 too, with its own sentence. */
      if (isNotBuiltYet(err) && err?.message === 'Route not found') setNotBuilt(true);
      else setErrors((prev) => ({ ...prev, [what]: subjectsErrorMessage(err, t) }));
    },
    [t]
  );

  const loadQueue = useCallback(
    () =>
      academicsService
        .classSubjects('PENDING')
        .then((list) => {
          setQueue(list);
          setErrors((prev) => ({ ...prev, queue: null }));
        })
        .catch(fail('queue')),
    [fail]
  );

  useEffect(() => {
    academicsService.academicYears().then(setYears).catch(fail('years'));
    academicsService.subjects().then(setCatalog).catch(fail('catalog'));
    loadQueue();
  }, [fail, loadQueue]);

  const loadTeachers = () => {
    if (teachers !== null) return;
    academicsService
      .teachers()
      .then(setTeachers)
      .catch(() => setTeachers([]));
  };

  const title = (
    <div className="select-none">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('subjects.title')}</h1>
      <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
        {t('subjects.subtitle', { school: membership?.school?.name ?? membership?.schoolName ?? '' })}
      </p>
    </div>
  );

  if (notBuilt) {
    return (
      <div className="space-y-6">
        {title}
        <NotBuiltYet />
      </div>
    );
  }

  const failed = (message) => (
    <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
      {message}
    </div>
  );
  const loading = <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />;

  const count = { PENDING: queue?.length ?? 0, CATALOG: catalog?.length ?? 0 };

  return (
    <div className="space-y-6">
      {title}

      <div className="border-b border-slate-100 flex gap-6 select-none overflow-x-auto">
        {SUBJECT_TABS.map((name) => {
          const isActive = tab === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              aria-pressed={isActive}
              className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none flex items-center gap-2 shrink-0 whitespace-nowrap ${
                isActive ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-600'
              }`}
            >
              {t(`subjects.tab.${name}`)}
              {count[name] > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                    name === 'PENDING' ? 'bg-amber-100 text-amber-800' : isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count[name]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'BOARD' &&
        (errors.years || errors.catalog
          ? failed(errors.years || errors.catalog)
          : years === null || catalog === null
            ? loading
            : (
              <SubjectBoard
                years={years}
                catalog={catalog}
                teachers={teachers}
                loadTeachers={loadTeachers}
                showToast={showToast}
              />
            ))}

      {tab === 'PENDING' && (
        <TeachingQueue
          requests={queue}
          error={errors.queue}
          onChanged={() => {
            loadQueue();
            notifyPendingChanged();
          }}
          showToast={showToast}
        />
      )}

      {tab === 'CATALOG' &&
        (errors.catalog
          ? failed(errors.catalog)
          : catalog === null
            ? loading
            : (
              <SubjectCatalog
                subjects={catalog}
                showToast={showToast}
                onCreated={() => academicsService.subjects().then(setCatalog).catch(fail('catalog'))}
              />
            ))}
    </div>
  );
};

export default SubjectsPage;
