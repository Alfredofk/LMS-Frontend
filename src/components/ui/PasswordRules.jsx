import React from 'react';

import { passwordChecklist } from '../../utils/validation';
import { useT } from '../../i18n/LanguageContext';

/*
  Every rule a new password must satisfy, and which ones it satisfies so far.

  This lived twice — byte for byte — in LoginForm and ResetPasswordPage, and
  changing the password on /account wanted a third copy. Three is where copying
  stops being cheap, so it moved here.

  The rules themselves are not this component's to decide. `passwordChecklist`
  owns them, and it mirrors the backend's own check exactly (auth.schema.js):
  eight characters, an upper, a lower, a digit, and a symbol that is not
  whitespace. A list that agreed with itself but not with the server would be
  worse than no list at all.

  `aria-live` because the list changes while somebody types without them moving
  focus to it — a screen reader would otherwise never mention that the password
  became acceptable.
*/
export const PasswordRules = ({ value = '' }) => {
  const { t } = useT();

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 pt-0.5" aria-live="polite">
      {passwordChecklist(value).map((rule) => (
        <li
          key={rule.key}
          className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
            rule.met ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <span
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shrink-0 ${
              rule.met ? 'bg-emerald-100' : 'bg-slate-100'
            }`}
            aria-hidden="true"
          >
            {rule.met ? '✓' : '•'}
          </span>
          {t(rule.key, rule.vars)}
        </li>
      ))}
    </ul>
  );
};

export default PasswordRules;
