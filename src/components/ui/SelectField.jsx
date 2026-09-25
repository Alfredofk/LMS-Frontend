import React from 'react';

/*
  A labelled <select>, drawn to match `Input` — the same classes JoinSchoolForm's
  grade picker uses. The classes page needs three (grade, homeroom teacher, a new
  homeroom teacher) and the join-request review a fourth (the student's class),
  so it lives beside Input rather than being pasted four times.
*/
export const SelectField = ({ id, label, value, onChange, error, disabled, children }) => (
  <div className="w-full flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-semibold text-slate-700 select-none">
      {label}
    </label>
    <select
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 md:py-3 px-4 text-base text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
    >
      {children}
    </select>
    {error && (
      <p id={`${id}-error`} className="text-xs text-red-500 font-medium">
        {error}
      </p>
    )}
  </div>
);

export default SelectField;
