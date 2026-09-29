/*
  What each holiday kind looks like — one table, so a calendar day, its legend
  entry and its row's badge can never disagree (components/holidays/HolidayParts).
  A file of its own because a component file may export only components (fast
  refresh). IN_SCHOOL is a joint-leave day the school stays open on.

  Contrast (owner, 2026-09-29): white on rose-500 measured 3.75:1 and white on
  amber-400 1.72:1 for the 11px day numbers; rose-600 and amber-950 text clear 4.5.
*/
export const KIND_STYLE = {
  NATIONAL: { solid: 'bg-rose-600 text-white', soft: 'bg-rose-50 text-rose-700', dot: 'bg-rose-600' },
  JOINT_LEAVE: { solid: 'bg-amber-400 text-amber-950', soft: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  SCHOOL: { solid: 'bg-brand text-white', soft: 'bg-brand-tint text-brand', dot: 'bg-brand' },
  IN_SCHOOL: { solid: 'bg-slate-200 text-slate-600', soft: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' },
};
