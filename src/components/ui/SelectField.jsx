import React from 'react';
import { ChevronDown } from 'lucide-react';

/*
  A labelled <select>, drawn to match `Input` — the same classes JoinSchoolForm's
  grade picker uses. The classes page needs three (grade, homeroom teacher, a new
  homeroom teacher) and the join-request review a fourth (the student's class),
  so it lives beside Input rather than being pasted four times.

  **The arrow is drawn here, not by the browser** (owner, 2026-09-26: "tidak
  simetris"). The native one sat flush against the right edge while the text
  kept 16px on the left, and looked different on every browser. So the select
  is `appearance-none` and a chevron sits 16px from the right — the same inset
  as the text on the left — with room kept for it (`pr-11`) so a long option
  never runs under it. `pointer-events-none`: a click on the arrow is a click
  on the select.
*/
export const SelectField = ({ id, label, value, onChange, error, disabled, children }) => (
  <div className="w-full flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-semibold text-slate-700 select-none">
      {label}
    </label>
    <div className="relative">
    <select
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className="block w-full appearance-none rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 md:py-3 pl-4 pr-11 text-base text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
    >
      {children}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
      aria-hidden="true"
    />
    </div>
    {error && (
      <p id={`${id}-error`} className="text-xs text-red-500 font-medium">
        {error}
      </p>
    )}
  </div>
);

export default SelectField;
