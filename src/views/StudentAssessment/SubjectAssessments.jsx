import React, { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useSchoolToday, useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { studentAssessmentErrorMessage } from '../../i18n/apiError';
import { formatNumber } from '../TeacherAssessment/results';
import { shortWhen, typeModeText } from '../TeacherAssessment/teacherAssessment';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import TodoRow from '../Dashboard/components/TodoRow';
import { readMyMenu } from './readMyMenu';
import { noteAssessmentTab } from './assessmentBack';
import { MENU_SECTIONS, afterRuleOf, belowKktpOf, canRetry, entriesOf, pathOf, practiceBestOf, sectionsOf, whenOf, wordOf } from './studentMenu';

/*
  A subject's "Penilaian" tab on the student's subject page (/classroom/:id?tab=penilaian;
  backend 113ae37, owner 2026-10-12): the subject's assessments from the semester's
  menu (readMyMenu), under Perlu dikerjakan / Akan datang / Selesai. A row opens the
  outline - or, with an attempt running, the attempt itself. Starting stays on the
  outline, where the integrity notice and the attempts are read first. A class the
  student left is read the same way; its outlines open with nothing to start.

  The look since 2026-10-28 (owner, mockup nilai-penilaian-siswa.html): one card,
  the three parts as the dashboards' text tabs with counts, opening on the first
  with anything in it; "Perlu dikerjakan" rows are the dashboard's (TodoRow: the
  date box, the pill, opening in place into "Mulai kerjakan"); in "Selesai" the
  cancelled ones come last under "Dibatalkan", their titles grey.

  The menu answers only the semesters one of the student's placements overlaps, so
  a 404 for this semester means it has none for them: said as no assessments.

  A LATIHAN's row shows its best attempt, "100" over "nilai terbaik" (backend
  026e4f9). A released score under the KKTP is red, the words said to a screen
  reader (backend 3814cf9).
*/

const CARD = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 text-left';

/* The word at a row's end, and its colour. */
const WORD_TONE = {
  NOT_STARTED: 'text-brand',
  IN_PROGRESS: 'text-sky-700',
  VOIDED: 'text-amber-700',
  LATE: 'text-amber-700',
  WAITING_FOR_RELEASE: 'text-slate-600',
  DONE: 'text-slate-600',
  DID_NOT_SUBMIT: 'text-rose-700',
  CANCELLED: 'text-rose-700',
};

const Row = ({ entry, zone, onOpen }) => {
  const { t, lang } = useT();
  const { assessment } = entry;
  const word = wordOf(entry);
  const when = whenOf(entry);
  const best = practiceBestOf(entry);
  const below = belowKktpOf(entry);
  const cancelled = assessment.status === 'CANCELLED';
  const exception = assessment.exception;
  const facts = [
    typeModeText(t, assessment),
    t(`smenu.when.${when.key}`, { when: shortWhen(when.instant, zone, lang) }),
    exception ? t(exception.remedial ? 'tasm.results.remedial' : exception.makeUp ? 'smenu.makeUp' : 'smenu.extraAttempts') : null,
  ].filter(Boolean);

  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="w-full text-left px-2 py-3.5 flex items-center gap-3 rounded-xl hover:bg-slate-50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className={`block text-sm font-extrabold break-words ${cancelled ? 'text-slate-500' : 'text-slate-900'}`}>{assessment.title}</span>
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
        <span className="shrink-0 text-right">
          {entry.status === 'RELEASED' && entry.score !== null && (
            <span className={`block text-base font-extrabold tabular-nums leading-tight ${below ? 'text-rose-700' : 'text-slate-900'}`}>
              {formatNumber(entry.score, lang)}
              {below && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
            </span>
          )}
          {best !== null && (
            <>
              <span className="block text-base font-extrabold text-slate-900 tabular-nums leading-tight">{formatNumber(best, lang)}</span>
              <span className="block text-[11px] font-semibold text-slate-500">{t('smenu.bestBelow')}</span>
            </>
          )}
          {afterRuleOf(entry) && (
            <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
              {t('smenu.afterRule', { score: formatNumber(afterRuleOf(entry).score, lang) })}
            </span>
          )}
          {word && <span className={`block text-xs font-bold ${WORD_TONE[word]}`}>{t(`smenu.status.${word}`)}</span>}
          {canRetry(entry) && <span className="block text-[11px] font-semibold text-brand">{t('smenu.retry')}</span>}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
};

/**
 * @param classSubjectId  the subject page's class subject
 * @param semesterId      its semester, the menu to read
 */
export const SubjectAssessments = ({ classSubjectId, semesterId }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  const today = useSchoolToday();
  const { membership } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const asked = `${semesterId}|${attempt}`;
  /* undefined reading · entries · { error } */
  const [read, setRead] = useState({ key: null, value: undefined });
  const value = read.key === asked ? read.value : undefined;
  /* The tab picked, null until one is: then the first with anything in it. */
  const [picked, setPicked] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readMyMenu(membership?.id, semesterId, { fresh: attempt > 0 })
      .then((menu) => !cancelled && setRead({ key: asked, value: entriesOf(menu.classes, classSubjectId) }))
      .catch((err) => {
        if (cancelled) return;
        setRead({ key: asked, value: err?.status === 404 ? [] : { error: studentAssessmentErrorMessage(err, t) } });
      });
    return () => {
      cancelled = true;
    };
  }, [asked, attempt, membership?.id, semesterId, classSubjectId, t]);

  const open = (entry) => {
    noteAssessmentTab(entry.assessment.id, 'penilaian');
    navigate(pathOf(entry));
  };

  if (value === undefined) {
    return (
      <div className={CARD} aria-busy="true" aria-label={t('common.loading')}>
        <Bone className="h-8 w-3/5" />
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex items-center gap-3 mt-4 px-2">
            <span className="flex-1">
              <Bone className="h-3.5 w-3/5" />
              <Bone className="h-3 w-2/5 mt-2" />
            </span>
            <Bone className="h-5 w-9" />
          </div>
        ))}
      </div>
    );
  }
  if (value.error) {
    return (
      <div className={CARD}>
        <HomeError message={value.error} retryLabel={t('att.error.retry')} onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  }

  const present = sectionsOf(value);
  if (present.length === 0) {
    return (
      <div className={CARD}>
        <HomeEmpty icon={ClipboardCheck} title={t('smenu.emptySubject')} body={t('smenu.emptySubject.body')} />
      </div>
    );
  }

  const byKey = new Map(present.map((section) => [section.key, section.entries]));
  const shown = picked ?? present[0].key;
  const entries = byKey.get(shown) ?? [];
  const live = entries.filter((entry) => entry.assessment.status !== 'CANCELLED');
  const cancelled = entries.filter((entry) => entry.assessment.status === 'CANCELLED');

  /* The line under the tabs is an inset shadow, as on the dashboard's TodoCard. */
  const tabs = (
    <div role="tablist" className="flex gap-0.5 mb-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
      {MENU_SECTIONS.map((key) => {
        const on = shown === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => {
              setPicked(key);
              setOpenId(null);
            }}
            className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-lg ${
              on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {t(`smenu.section.${key}`)}
            <span className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>
              {byKey.get(key)?.length ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );

  let list;
  if (entries.length === 0) {
    list = <HomeEmpty icon={ClipboardCheck} title={t(`smenu.sectionEmpty.${shown}`)} />;
  } else if (shown === 'TODO') {
    list = (
      <ul>
        {entries.map((entry) => (
          <TodoRow
            key={entry.assessment.id}
            entry={entry}
            open={openId === entry.assessment.id}
            onToggle={() => setOpenId(openId === entry.assessment.id ? null : entry.assessment.id)}
            onLater={() => setOpenId(null)}
            zone={zone}
            today={today}
            showSubject={false}
            onStart={(started) => noteAssessmentTab(started.assessment.id, 'penilaian')}
          />
        ))}
      </ul>
    );
  } else {
    list = (
      <>
        {live.length > 0 && (
          <ul>
            {live.map((entry) => (
              <Row key={entry.assessment.id} entry={entry} zone={zone} onOpen={open} />
            ))}
          </ul>
        )}
        {cancelled.length > 0 && (
          <>
            <p className={`px-2 pb-1 text-xs font-bold text-slate-600 ${live.length > 0 ? 'mt-4' : ''}`}>{t('smenu.cancelledGroup')}</p>
            <ul>
              {cancelled.map((entry) => (
                <Row key={entry.assessment.id} entry={entry} zone={zone} onOpen={open} />
              ))}
            </ul>
          </>
        )}
      </>
    );
  }

  return (
    <section className={CARD} aria-label={t('smenu.tabLabel')}>
      {tabs}
      <div role="tabpanel">{list}</div>
    </section>
  );
};

export default SubjectAssessments;
