import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Sparkles } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { holidaysService } from '../../services/holidaysService';
import { calendarItems, nextHoliday, offDaysOf, todayIso } from '../../utils/holidays';

/*
  The next day off, on a dashboard (owner, 2026-09-29): the student's and the
  guardian's — the people a school day off matters to most, who otherwise see
  the calendar only on /schedule, or, for a guardian, nowhere.

  `GET /holidays?year=` is read by every ACTIVE member (backend 9dee2e2). The
  same arithmetic as /schedule — `calendarItems`, `offDaysOf`, `nextHoliday` —
  so the two can never name different days. When this year has nothing left
  (the last weeks of December), next year's calendar is read too, once.

  `showLink` sends the reader to /schedule; a guardian cannot open it, so their
  card has none. A failed read draws nothing: this is a convenience beside the
  page's real content, and an error panel here would outweigh it.

  The look is /schedule's "Libur berikutnya" tile (HolidayParts SummaryCards).
*/
const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

export const NextHolidayCard = ({ showLink = false }) => {
  const { t, lang } = useT();
  /* undefined while reading, null when there is nothing (or the read failed). */
  const [next, setNext] = useState(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = todayIso();
    const year = Number(today.slice(0, 4));
    const upcoming = async (y) => nextHoliday(offDaysOf(calendarItems(await holidaysService.calendar(y))), today);

    (async () => {
      try {
        const found = (await upcoming(year)) ?? (await upcoming(year + 1));
        if (!cancelled) setNext(found);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;

  const date = (day, withYear) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(localeOf(lang), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });

  return (
    <section
      aria-label={t('holiday.next')}
      className="rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-5 text-white shadow-sm relative overflow-hidden"
    >
      <Sparkles className="absolute -right-2 -top-2 w-20 h-20 text-white/10" aria-hidden="true" />
      <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">{t('holiday.next')}</p>
          {next === undefined ? (
            <div className="mt-2 h-10 w-48 max-w-full rounded-lg bg-white/15 animate-pulse" aria-label={t('common.loading')} />
          ) : next ? (
            <>
              <p className="mt-1 text-base font-extrabold leading-snug break-words">{next.name}</p>
              <p className="mt-0.5 text-xs font-semibold text-white/90">
                {/* The year only when it is not this one — next January, read in December. */}
                {date(next.start, next.start.slice(0, 4) !== todayIso().slice(0, 4))}
                {next.end !== next.start && ` - ${date(next.end, false)}`}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                {next.days === 0 ? t('holiday.next.today') : t('holiday.next.in', { n: next.days })}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-white/90">{t('holiday.next.noneAhead')}</p>
          )}
        </div>
        {showLink && (
          <Link
            to="/schedule"
            className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-black/10 px-3 py-2 text-xs font-extrabold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {t('holiday.next.seeCalendar')}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
};

export default NextHolidayCard;
