import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { meetingWindow } from '../../views/Classroom/myClasses';

/*
  A subject's meetings as a row of tabs (owner, 2026-10-04, after BINUSMAYA's
  course page): eight around the chosen one (`meetingWindow`), the rest behind
  "N more". Shared by a student's subject page and a teacher's, which differ only
  in what the small dot on a tab says (`dotOf(session)` → a bg class, or null) -
  the student's attendance, or for the teacher a meeting still to confirm.
  Cancelled meetings are struck through. On a narrow screen the row scrolls
  sideways and keeps the chosen tab in the middle.
*/

const MeetingTab = ({ session, selected, dot, onPick, t }) => {
  const cancelled = session.status === 'CANCELLED';
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onPick(session.id)}
      title={cancelled ? t(`timetable.session.cancelled.${session.cancelReason ?? 'OTHER'}`) : undefined}
      className={`relative shrink-0 px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        selected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      } ${cancelled ? 'line-through opacity-70' : ''}`}
    >
      {t('meeting.tab', { n: session.number })}
      {dot && <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />}
    </button>
  );
};

const MoreMenu = ({ rest, onPick, t }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (rest.length === 0) return null;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-t-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-extrabold whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {t('meeting.more', { n: rest.length })}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className="absolute right-0 top-full mt-1 z-20 w-44 max-h-72 overflow-y-auto rounded-xl bg-white border border-slate-100 shadow-2xl p-1">
          {rest.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(session.id);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer ${
                  session.status === 'CANCELLED' ? 'line-through opacity-70' : ''
                }`}
              >
                {t('meeting.tab', { n: session.number })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const MeetingStrip = ({ sessions, selectedId, onPick, dotOf }) => {
  const { t } = useT();
  const tabsRef = useRef(null);
  const { shown, rest } = meetingWindow(sessions ?? [], selectedId);

  useEffect(() => {
    const row = tabsRef.current;
    const tab = row?.querySelector('[aria-selected="true"]');
    if (!row || !tab) return;
    row.scrollLeft = tab.offsetLeft - row.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
  }, [selectedId]);

  return (
    <div className="flex items-end gap-1.5 border-b-2 border-brand">
      <div
        ref={tabsRef}
        role="tablist"
        aria-label={t('classroom.meetings')}
        className="flex items-end gap-1.5 overflow-x-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((session) => (
          <MeetingTab
            key={session.id}
            session={session}
            selected={session.id === selectedId}
            dot={dotOf?.(session) ?? null}
            onPick={onPick}
            t={t}
          />
        ))}
      </div>
      <MoreMenu rest={rest} onPick={onPick} t={t} />
    </div>
  );
};

export default MeetingStrip;
