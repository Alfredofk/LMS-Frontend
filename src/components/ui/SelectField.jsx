import React from 'react';

import Select from './Select';

/*
  A labelled dropdown, drawn to match `Input`. Every form in the app uses this
  one, so the label, the box and the error line sit the same way everywhere.

  The box and its list are `Select` since 2026-10-03 (owner: one polished
  dropdown style everywhere); the children are still plain `<option>`s, so the
  call sites read like a native <select>.
*/
export const SelectField = ({ id, label, value, onChange, error, disabled, children }) => (
  <div className="w-full flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-semibold text-slate-700 select-none">
      {label}
    </label>
    <Select
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
    >
      {children}
    </Select>
    {error && (
      <p id={`${id}-error`} className="text-xs text-red-500 font-medium">
        {error}
      </p>
    )}
  </div>
);

export default SelectField;
