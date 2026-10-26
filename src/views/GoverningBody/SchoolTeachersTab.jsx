import React, { useCallback, useEffect, useState } from 'react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SubjectLabel from '../../components/ui/SubjectLabel';
import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { staffRolesOf, teacherMatches, termOf } from './schoolPeople';

/*
  The "Guru" tab of a School's page (backend f01cd28, ticket 07; owner 2026-10-26, D4):
  `GET .../schools/:id/teachers` once, all of them by name - the Principal and a Vice
  Principal too when they teach - searched here by name, NIP or NUPTK. Each: the name
  with NIP / NUPTK, the staff roles, the subjects taught this Semester and the Classes
  they are homeroom teacher of this year. A table from md, a card per teacher below.
  Read only: no row opens anything.
*/

const COLUMNS = 'md:grid md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.3fr)_8rem] md:gap-4 md:items-start';

/* A cell's own label, on a phone only: the table's header row says it from md. */
const CellLabel = ({ children }) => <span className="md:hidden text-[11px] font-semibold text-slate-500 block">{children}</span>;

export const SchoolTeachersTab = ({ schoolId, onGone }) => {
  const { t } = useT();
  const [answer, setAnswer] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [needle, setNeedle] = useState('');

  const load = useCallback(() => {
    governingBodyService
      .schoolTeachers(schoolId)
      .then((read) => {
        setAnswer(read);
        setState('ready');
      })
      .catch((err) => {
        if (err?.status === 403) {
          onGone();
          return;
        }
        setError(err);
        setState('failed');
      });
  }, [schoolId, onGone]);

  useEffect(() => {
    load();
  }, [load]);

  const teachers = answer?.teachers ?? [];
  const shown = teachers.filter((teacher) => teacherMatches(teacher, needle));
  const term = termOf(answer);

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      {state === 'loading' && <div className="h-32 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />}

      {state === 'failed' && (
        <div className="space-y-3" role="alert">
          <p className="text-sm font-semibold text-rose-700">{governingBodySeatErrorMessage(error, t)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setState('loading');
              load();
            }}
          >
            {t('gb.retry')}
          </Button>
        </div>
      )}

      {state === 'ready' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900">{t('gbsp.teachers.title')}</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">{t(term.key, term.vars)}</p>
            </div>
            {teachers.length > 0 && (
              <div className="w-full sm:max-w-xs">
                <Input
                  id="gbspTeacherSearch"
                  name="search"
                  type="search"
                  label={t('gbsp.teachers.search')}
                  placeholder={t('gbsp.teachers.searchPlaceholder')}
                  autoComplete="off"
                  value={needle}
                  onChange={(e) => setNeedle(e.target.value)}
                />
              </div>
            )}
          </div>

          {teachers.length === 0 ? (
            <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-prose">{t('gbsp.teachers.empty')}</p>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-500" aria-live="polite">
                {needle.trim() ? t('gbsp.teachers.countFiltered', { shown: shown.length, n: teachers.length }) : t('gbsp.teachers.count', { n: teachers.length })}
              </p>
              {shown.length === 0 ? (
                <p className="text-sm font-medium text-slate-500 py-2">{t('gbsp.teachers.noMatch')}</p>
              ) : (
                <div>
                  <div className={`hidden ${COLUMNS} pb-2 border-b border-slate-100 text-[11px] font-semibold text-slate-500`} aria-hidden="true">
                    <span>{t('gbsp.col.name')}</span>
                    <span>{t('gbsp.col.roles')}</span>
                    <span>{t('gbsp.col.subjects')}</span>
                    <span>{t('gbsp.col.homeroom')}</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {shown.map((teacher) => (
                      <li key={teacher.membershipId} className={`py-3.5 grid gap-y-2.5 ${COLUMNS}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 break-words">{teacher.fullName}</p>
                          <p className="flex flex-wrap gap-x-4 text-xs font-medium text-slate-500 mt-0.5">
                            {teacher.nip && <span className="tabular-nums">{t('gbsp.nip', { nip: teacher.nip })}</span>}
                            {teacher.nuptk && <span className="tabular-nums">{t('gbsp.nuptk', { nuptk: teacher.nuptk })}</span>}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <CellLabel>{t('gbsp.col.roles')}</CellLabel>
                          <p className="text-sm font-semibold text-slate-700">{staffRolesOf(teacher).map((role) => t(`roleTitle.${role}`)).join(', ')}</p>
                        </div>
                        <div className="min-w-0">
                          <CellLabel>{t('gbsp.col.subjects')}</CellLabel>
                          {teacher.classSubjects.length === 0 ? (
                            <p className="text-sm font-medium text-slate-500">{t('gbsp.none')}</p>
                          ) : (
                            <ul className="space-y-1">
                              {teacher.classSubjects.map((row) => (
                                <li key={row.id} className="text-sm font-medium text-slate-700 flex flex-wrap items-center gap-x-1.5">
                                  <SubjectLabel code={row.subject.code} name={row.subject.name} />
                                  <span className="text-slate-300">/</span>
                                  <span>{row.class.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="min-w-0">
                          <CellLabel>{t('gbsp.col.homeroom')}</CellLabel>
                          <p className={`text-sm font-medium ${teacher.homeroomOf.length ? 'text-slate-700' : 'text-slate-500'}`}>
                            {teacher.homeroomOf.length ? teacher.homeroomOf.map((row) => row.name).join(', ') : t('gbsp.none')}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};

export default SchoolTeachersTab;
