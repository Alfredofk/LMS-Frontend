import React, { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import { useAuth } from '../../context/AuthContext';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { studentAssessmentErrorMessage } from '../../i18n/apiError';
import { formatNumber } from '../TeacherAssessment/results';
import { shortWhen, typeModeText } from '../TeacherAssessment/teacherAssessment';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { readMyMenu } from '../StudentAssessment/readMyMenu';
import { afterRuleOf, belowKktpOf, scoredEntriesOf, scoresSummaryOf, whenOf } from '../StudentAssessment/studentMenu';
import { noteAssessmentTab } from '../StudentAssessment/assessmentBack';

/*
  A subject's "Nilai" tab on the student's subject page (/classroom/:id?tab=nilai;
  owner 2026-10-14, like the teacher's "Nilai" tab): what is marked or can no
  longer be answered - the score that counts once released, "Menunggu rilis",
  "Tidak mengumpulkan" - latest closed first (scoredEntriesOf). A row opens the
  outline, where the attempts, points per question and the teacher's comments are
  read. The sidebar's "Nilai" (/scores) is only a way in: the subjects as cards,
  each opening this tab. It used to list every subject's scores on one page.

  The look since 2026-10-28 (owner, mockup nilai-penilaian-siswa.html): one
  "Nilai" card, a slash line ("4 dirilis / 1 menunggu rilis / KKTP 70"), three
  numbers counted from the list itself (scoresSummaryOf: tuntas, under the KKTP,
  waiting), one line saying what red means, then the rows.

  No average or final mark: the Final Grade is never a student's to read. A score
  under the KKTP is red (backend 3814cf9: each entry carries the `kktp` it is
  counted with; owner 2026-10-19). Never a LATIHAN, which is not graded
  (scoredEntriesOf). Read from the semester's GET /assessments/mine (readMyMenu), as
  the "Penilaian" tab is; a 404 for the semester means none for this student.
*/

const CARD = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 text-left';

const WORD_TONE = {
  WAITING_FOR_RELEASE: 'text-slate-600',
  DID_NOT_SUBMIT: 'text-rose-700',
};

const ScoreRow = ({ entry, zone, onOpen }) => {
  const { t, lang } = useT();
  const { assessment } = entry;
  /* "ditutup" or "sampai": one waiting for release may still be open (2026-10-12). */
  const when = whenOf(entry);
  const facts = [typeModeText(t, assessment), t(`smenu.when.${when.key}`, { when: shortWhen(when.instant, zone, lang) })];
  const below = belowKktpOf(entry);
  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block text-sm font-extrabold text-slate-900 break-words">{assessment.title}</span>
          {/* FactLine's look - grey, light slashes - in spans: a button takes no <p>. */}
          <span className="block text-xs font-semibold text-slate-500">
            {facts.map((part, i) => (
              <Fragment key={part}>
                {i > 0 && (
                  <>
                    {' '}
                    <span className="mx-1 text-slate-300" aria-hidden="true">
                      /
                    </span>{' '}
                  </>
                )}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </span>
        </span>
        {entry.status === 'RELEASED' && entry.score !== null ? (
          <span className="shrink-0 text-right">
            <span className={`block text-lg font-extrabold tabular-nums leading-tight ${below ? 'text-rose-700' : 'text-slate-900'}`}>
              {formatNumber(entry.score, lang)}
              {below && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
            </span>
            {afterRuleOf(entry) && (
              <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                {t('smenu.afterRule', { score: formatNumber(afterRuleOf(entry).score, lang) })}
              </span>
            )}
          </span>
        ) : (
          <span className={`shrink-0 text-xs font-bold ${WORD_TONE[entry.status] ?? 'text-slate-600'}`}>{t(`smenu.status.${entry.status}`)}</span>
        )}
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
};

/* The three numbers over the rows: what reaches the KKTP, what is under it, what waits. */
const Summary = ({ summary }) => {
  const { t } = useT();
  const cells = [
    {
      key: 'passed',
      value: summary.passed === null || summary.released === 0 ? '-' : t('scores.sum.ofValue', { n: summary.passed, total: summary.released }),
      tone: summary.passed > 0 ? 'text-emerald-700' : 'text-slate-900',
    },
    { key: 'below', value: summary.below === null ? '-' : String(summary.below), tone: summary.below > 0 ? 'text-rose-700' : 'text-slate-900' },
    { key: 'waiting', value: String(summary.waiting), tone: 'text-slate-900' },
  ];
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
      {cells.map(({ key, value, tone }) => (
        <p key={key} className="min-w-0 rounded-xl border border-slate-100 px-2.5 sm:px-3 py-2.5">
          <span className={`block text-lg sm:text-xl font-extrabold tabular-nums leading-tight ${tone}`}>{value}</span>
          <span className="block text-xs font-semibold text-slate-500">{t(`scores.sum.${key}`)}</span>
        </p>
      ))}
    </div>
  );
};

/**
 * @param classSubjectId  the subject page's class subject
 * @param semesterId      its semester, the menu to read
 */
export const SubjectScores = ({ classSubjectId, semesterId }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  const { membership } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const asked = `${semesterId}|${attempt}`;
  /* undefined reading · entries · { error } */
  const [read, setRead] = useState({ key: null, value: undefined });
  const value = read.key === asked ? read.value : undefined;

  useEffect(() => {
    let cancelled = false;
    readMyMenu(membership?.id, semesterId, { fresh: attempt > 0 })
      .then((menu) => !cancelled && setRead({ key: asked, value: scoredEntriesOf(menu.classes, classSubjectId) }))
      .catch((err) => {
        if (cancelled) return;
        setRead({ key: asked, value: err?.status === 404 ? [] : { error: studentAssessmentErrorMessage(err, t) } });
      });
    return () => {
      cancelled = true;
    };
  }, [asked, attempt, membership?.id, semesterId, classSubjectId, t]);

  const ready = Array.isArray(value) && value.length > 0;
  /* One KKTP per subject: the reporting slot's, the same on every entry. */
  const kktp = ready ? (value.find((entry) => typeof entry.kktp === 'number')?.kktp ?? null) : null;
  const summary = ready ? scoresSummaryOf(value) : null;
  const facts = summary
    ? [
        t('scores.facts.released', { n: summary.released }),
        summary.waiting > 0 ? t('scores.facts.waiting', { n: summary.waiting }) : null,
        kktp !== null ? t('gradebook.facts.kktp', { kktp }) : null,
      ]
    : [];

  let body;
  if (value === undefined) {
    body = (
      <ul className="mt-4 border border-slate-100 rounded-xl" aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((n) => (
          <li key={n} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100 last:border-0">
            <span className="flex-1">
              <Bone className="h-3.5 w-3/5" />
              <Bone className="h-3 w-2/5 mt-2" />
            </span>
            <Bone className="h-5 w-9" />
          </li>
        ))}
      </ul>
    );
  } else if (value.error) {
    body = (
      <div className="mt-4">
        <HomeError message={value.error} retryLabel={t('att.error.retry')} onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  } else if (value.length === 0) {
    body = <HomeEmpty icon={ClipboardCheck} title={t('scores.empty.title')} body={t('scores.empty.body')} />;
  } else {
    body = (
      <>
        <Summary summary={summary} />
        {kktp !== null && (
          <p className="mt-3.5 text-[13px] font-medium text-slate-500">
            <span className="text-rose-700">{t('gradebook.kktp.red')}</span> {t('scores.legend')}
          </p>
        )}
        <ul className="mt-4 border border-slate-100 rounded-xl overflow-hidden">
          {value.map((entry) => (
            <ScoreRow
              key={entry.assessment.id}
              entry={entry}
              zone={zone}
              onOpen={(picked) => {
                /* The navbar's arrow on the outline comes back to this tab. */
                noteAssessmentTab(picked.assessment.id, 'nilai');
                navigate(`/assessment/${picked.assessment.id}`);
              }}
            />
          ))}
        </ul>
      </>
    );
  }

  return (
    <section className={CARD} aria-labelledby={`scores-${classSubjectId}`}>
      <h3 id={`scores-${classSubjectId}`} className="text-base font-extrabold text-slate-900 tracking-tight">
        {t('scores.card.title')}
      </h3>
      {facts.length > 0 && <FactLine className="mt-0.5" facts={facts.filter(Boolean)} />}
      {body}
    </section>
  );
};

export default SubjectScores;
