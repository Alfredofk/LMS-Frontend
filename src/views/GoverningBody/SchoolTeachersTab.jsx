import React, { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { ADMIN_CARD, SlashFacts } from '../Admin/adminParts';
import { HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { Initials, RowsLoading, SearchBox } from './bodyParts';
import { staffRolesOf, teacherMatches, termOf } from './schoolPeople';

/*
  The "Guru" tab of a School's page (backend f01cd28, ticket 07; owner 2026-10-26, D4):
  `GET .../schools/:id/teachers` once, all of them by name - the Principal and a Vice
  Principal too when they teach - searched here by name, NIP or NUPTK. Read only: no
  row opens anything.

  Since 2026-10-29 (owner, mockup yayasan-sekolah-admin.html) a search box above one
  card of rows, "N guru / the term" at its top: round initials, the name, a grey slash
  line of the staff roles and NIP / NUPTK, then "Mengajar: ..." with the subjects this
  Semester and "Wali kelas: ..." with this year's Classes. It was a four-column table.
*/

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

  if (state === 'loading') return <RowsLoading />;

  if (state === 'failed') {
    return (
      <div className={ADMIN_CARD}>
        <HomeError
          message={governingBodySeatErrorMessage(error, t)}
          retryLabel={t('gb.retry')}
          onRetry={() => {
            setState('loading');
            load();
          }}
        />
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <div className={ADMIN_CARD}>
        <HomeEmpty icon={Users} title={t('gbsp.teachers.emptyTitle')} body={t('gbsp.teachers.empty')} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SearchBox
        id="gbspTeacherSearch"
        label={t('gbsp.teachers.search')}
        placeholder={t('gbsp.teachers.searchPlaceholder')}
        value={needle}
        onChange={setNeedle}
      />
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0">
        <SlashFacts
          className="block px-4 sm:px-5 pt-3.5 text-xs font-semibold text-slate-500"
          parts={[
            <span aria-live="polite">
              {needle.trim() ? t('gbsp.teachers.countFiltered', { shown: shown.length, n: teachers.length }) : t('gbsp.teachers.count', { n: teachers.length })}
            </span>,
            t(term.key, term.vars),
          ]}
        />
        {shown.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 text-sm font-medium text-slate-500">{t('gbsp.teachers.noMatch')}</p>
        ) : (
          <ul>
            {shown.map((teacher) => (
              <li key={teacher.membershipId} className="px-4 sm:px-5 py-3.5 border-b border-slate-100 last:border-0 flex items-start gap-3">
                <Initials name={teacher.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 break-words">{teacher.fullName}</p>
                  <SlashFacts
                    className="block mt-0.5 text-xs font-medium text-slate-500"
                    parts={[
                      staffRolesOf(teacher).map((role) => t(`roleTitle.${role}`)).join(', '),
                      teacher.nip && <span className="tabular-nums">{t('gbsp.nip', { nip: teacher.nip })}</span>,
                      teacher.nuptk && <span className="tabular-nums">{t('gbsp.nuptk', { nuptk: teacher.nuptk })}</span>,
                    ]}
                  />
                  <p className="mt-1 text-xs font-medium text-slate-600 break-words">
                    {t('gbsp.teaches', {
                      list: teacher.classSubjects.length
                        ? teacher.classSubjects
                            .map((row) => t('gbsp.subjectIn', { code: row.subject.code, name: row.subject.name, class: row.class.name }))
                            .join(', ')
                        : t('gbsp.none'),
                    })}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600 break-words">
                    {t('gbsp.homeroomLine', { list: teacher.homeroomOf.length ? teacher.homeroomOf.map((row) => row.name).join(', ') : t('gbsp.none') })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SchoolTeachersTab;
