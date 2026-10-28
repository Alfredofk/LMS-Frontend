import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FileText } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import Button from '../../../components/ui/Button';
import { materialsOf, rateOf } from '../../Classroom/myProgress';
import ThreePartBar from '../../../components/ThreePartBar';
import { nextToFinishOf } from '../studentHome';
import { Bone, FactCell, HomeCard, HomeEmpty, HomeError, Unfold } from './HomeCard';

/*
  "Kemajuan mapel" (owner, 2026-10-27): the semester's materials in one number
  first, then a row per subject with a three-part bar - completed, opened, not
  opened (GET /tracking/me/progress records both) - and its percentage, or
  "Tuntas". A row opens in place into its counts, its teacher and the meeting to
  carry on with, which "Lanjutkan" opens. The meetings say which one: the
  earliest begun whose materials are not all completed (nextToFinishOf); the
  backend names no single next material.

  @param subjects  [{ entry, progress }] (currentSubjects), null while reading
  @param subjectsFailed  the subjects could not be read
  @param progress  GET /tracking/me/progress, undefined while reading, null when it failed
  @param sessionsById  each subject's meetings, from readMyClasses
  @param onRetry   reads both again
*/

export const SubjectProgressCard = ({ subjects, subjectsFailed, progress, sessionsById, onRetry }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);

  const card = (body) => (
    <HomeCard id="home-subjects" title={t('dash.subj.title')} linkLabel={t('shell.myCourses')} linkTo="/classroom">
      {body}
    </HomeCard>
  );

  if (!subjectsFailed && (subjects === null || progress === undefined)) {
    return card(
      <div aria-busy="true">
        <Bone className="h-7 w-1/3" />
        <Bone className="h-2.5 w-full mt-2.5" />
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="py-2.5 mt-1">
            <Bone className="h-3.5 w-1/2" />
            <Bone className="h-2 w-full mt-2.5" />
          </div>
        ))}
      </div>
    );
  }
  if (subjectsFailed || progress === null) {
    return card(<HomeError message={t('dash.board.failed')} retryLabel={t('att.error.retry')} onRetry={onRetry} />);
  }

  /* A subject whose teacher has shared nothing yet goes last, with words instead of an empty bar. */
  const rows = subjects
    .map(({ entry }) => ({ entry, ...materialsOf(progress, entry.id) }))
    .sort((a, b) => Number(b.published > 0) - Number(a.published > 0));
  const total = rows.reduce((sum, row) => ({ published: sum.published + row.published, done: sum.done + row.done, opened: sum.opened + row.opened }), {
    published: 0,
    done: 0,
    opened: 0,
  });

  if (rows.length === 0 || total.published === 0) {
    return card(<HomeEmpty icon={FileText} title={t('dash.subj.empty')} body={t('dash.board.noMaterials')} />);
  }

  const barLabel = (row) => t('dash.subj.bar', { done: row.done, opened: row.opened - row.done, none: row.published - row.opened });

  return card(
    <>
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 mb-2">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-2.5">
          <b className="text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-slate-900">{rateOf(total.done, total.published)}%</b>
          <span className="text-[12.5px] text-slate-500">{t('dash.subj.summary', { done: total.done, total: total.published })}</span>
        </div>
        <ThreePartBar large done={total.done} opened={total.opened} total={total.published} label={barLabel(total)} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11.5px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-[3px] bg-brand" aria-hidden="true" />
            {t('dash.subj.done')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-[3px] bg-brand/35" aria-hidden="true" />
            {t('dash.subj.opened')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-[3px] bg-slate-200" aria-hidden="true" />
            {t('dash.subj.none')}
          </span>
        </div>
      </div>

      <ul>
        {rows.map((row) => {
          const { entry } = row;
          const open = openId === entry.id;
          const full = row.published > 0 && row.done === row.published;
          const next = full ? null : nextToFinishOf(sessionsById?.[entry.id]);
          return (
            <li key={entry.id} className="border-b border-slate-100 last:border-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : entry.id)}
                className={`block w-full text-left px-2 py-3 rounded-xl transition-colors cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  open ? 'bg-slate-50' : ''
                }`}
              >
                <span className="flex items-baseline justify-between gap-2.5 text-sm">
                  <b className="min-w-0 truncate font-bold text-slate-900">
                    {entry.subject?.code && <span className="mr-1.5 text-[11px] text-brand">{entry.subject.code}</span>}
                    {entry.subject?.name}
                  </b>
                  {full ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
                      {t('dash.subj.full')}
                    </span>
                  ) : row.published > 0 ? (
                    <span className="shrink-0 text-sm font-extrabold text-slate-700 tabular-nums">{rateOf(row.done, row.published)}%</span>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-500">{t('dash.subj.noneYet')}</span>
                  )}
                </span>
                {row.published > 0 && <ThreePartBar done={row.done} opened={row.opened} total={row.published} label={barLabel(row)} />}
              </button>
              <Unfold open={open}>
                <div className="px-2 pt-1.5 pb-4">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
                    <FactCell label={t('dash.subj.done')}>{row.done}</FactCell>
                    <FactCell label={t('dash.subj.opened')}>{row.opened - row.done}</FactCell>
                    <FactCell label={t('dash.subj.none')}>{row.published - row.opened}</FactCell>
                    <FactCell label={t('dash.subj.teacher')}>{entry.teacher?.fullName ?? '-'}</FactCell>
                  </div>
                  {next ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 mb-3">
                      <small className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('dash.subj.next')}</small>
                      <b className="text-sm font-bold text-slate-900">{t('dash.subj.nextLine', { n: next.session.number, left: next.left })}</b>
                    </div>
                  ) : (
                    <p className="mb-3 text-[13px] text-slate-600">
                      {full ? t('dash.subj.allDone', { name: entry.subject?.name ?? '' }) : row.published === 0 ? t('dash.board.noMaterials') : t('dash.subj.nothingBegun')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {next && (
                      <Button size="sm" onClick={() => navigate(`/classroom/${entry.id}?pertemuan=${next.session.id}`)}>
                        {t('dash.subj.continue')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigate(`/classroom/${entry.id}`)}>
                      {t('dash.subj.open')}
                    </Button>
                  </div>
                </div>
              </Unfold>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default SubjectProgressCard;
