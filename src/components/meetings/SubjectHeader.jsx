import React from 'react';
import { BookOpen } from 'lucide-react';

/*
  A subject's page header (owner, 2026-10-04): an icon tile, the code as a small
  label above the name, the facts as labelled cells, then a progress bar. Shared by
  a student's subject page and a teacher's, which pass their own facts.

  @param code, name
  @param facts     [{ label, value: ReactNode }] - two to four cells
  @param progress  { label, percent } or null
*/

const Fact = ({ label, children }) => (
  <div className="bg-white px-5 sm:px-6 py-3 min-w-0">
    <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm font-extrabold text-slate-800 break-words">{children}</dd>
  </div>
);

const initialsOf = (name = '') =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/* A person in a fact cell: initials in a small circle, then the name. */
export const PersonFact = ({ name }) => (
  <span className="flex items-center gap-2 min-w-0">
    <span className="w-6 h-6 rounded-full bg-brand-tint text-brand text-[10px] font-extrabold flex items-center justify-center shrink-0" aria-hidden="true">
      {initialsOf(name)}
    </span>
    <span className="break-words min-w-0">{name}</span>
  </span>
);

export const SubjectHeader = ({ code, name, facts, progress = null }) => (
  <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
    <div className="p-5 sm:p-6 flex items-center gap-4">
      <span className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-tint text-brand rounded-2xl flex items-center justify-center shrink-0">
        <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {code && <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand">{code}</p>}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">{name}</h1>
      </div>
    </div>
    <dl className={`grid grid-cols-2 ${facts.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-px bg-slate-100 border-y border-slate-100`}>
      {facts.map((fact) => (
        <Fact key={fact.label} label={fact.label}>
          {fact.value}
        </Fact>
      ))}
    </dl>
    {progress && (
      <div className="px-5 sm:px-6 py-4 space-y-2 min-w-0">
        <div className="flex items-baseline justify-between gap-3 tabular-nums">
          <span className="text-xs font-semibold text-slate-500">{progress.label}</span>
          <span className="text-sm font-extrabold text-slate-800">{progress.percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>
    )}
  </section>
);

export default SubjectHeader;
