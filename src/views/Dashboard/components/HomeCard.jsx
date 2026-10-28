import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';

import Button from '../../../components/ui/Button';

/*
  The frame the student dashboard's cards share (owner, 2026-10-27; the design
  kept in `.claude/skills/eduforid-design`): a white card, its title as a word,
  and a link at the right whose arrow nudges on hover. Plus the three states a
  data card has besides its content - loading, empty, failed.
*/

export const HomeCard = ({ id, title, linkLabel, linkTo, children, className = '' }) => {
  const navigate = useNavigate();
  return (
    /* A column filling its grid cell, so two cards in a row end level (owner's
       screenshots, 2026-10-27); the body takes the height left for a centred state. */
    <section aria-labelledby={id} className={`h-full flex flex-col bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 text-left ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 id={id} className="text-base font-extrabold text-slate-900 tracking-tight">
          {title}
        </h2>
        {linkTo && (
          <button
            type="button"
            onClick={() => navigate(linkTo)}
            className="group shrink-0 inline-flex items-center gap-1 text-sm font-bold text-brand cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {linkLabel}
            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </section>
  );
};

/** A grey block standing in for content still reading. */
export const Bone = ({ className = '' }) => <div className={`animate-pulse bg-slate-100 rounded-[10px] ${className}`} aria-hidden="true" />;

/** Nothing to show: a slate tile, what is missing, when it will come, and at most one way on. */
export const HomeEmpty = ({ icon: Icon, title, body, action }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center py-7 px-3">
    <div className="mx-auto mb-2.5 grid place-items-center w-11 h-11 rounded-[14px] bg-slate-100 text-slate-500">
      {Icon && <Icon className="w-5 h-5" aria-hidden="true" />}
    </div>
    <p className="text-sm font-extrabold text-slate-900">{title}</p>
    {body && <p className="mx-auto mt-1 max-w-[34ch] text-[13px] text-slate-500">{body}</p>}
    {action && <div className="mt-3.5">{action}</div>}
  </div>
);

/** A read that failed: said in place, with a way to read again. */
export const HomeError = ({ message, retryLabel, onRetry }) => (
  <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 p-3.5 text-[13px] font-semibold text-rose-700">
    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1">{message}</span>
    {onRetry && (
      <Button size="sm" variant="outline" onClick={onRetry}>
        {retryLabel}
      </Button>
    )}
  </div>
);

/** An eyebrow on its value, for a row's details. */
export const FactCell = ({ label, children }) => (
  <div>
    <small className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</small>
    <b className="text-sm font-bold text-slate-900">{children}</b>
  </div>
);

/** The shell of a row's details: closed it takes no room, open it slides down. */
export const Unfold = ({ open, children }) => (
  <div
    className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
    }`}
  >
    <div className="overflow-hidden" inert={open ? undefined : true}>
      {children}
    </div>
  </div>
);

export default HomeCard;
