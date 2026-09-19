import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import id from './id';
import en from './en';
import { LANGUAGES } from './languages';

/*
  Two languages, one dictionary each, no library.

  react-i18next would bring plurals, namespaces and lazy loading; none of that is
  needed for two languages and flat sentences, and this project already says it
  keeps no state manager beyond React Context. Eighty lines here beats a
  dependency and its configuration.

  Indonesian is the default because the people using this are Indonesian schools.
  English is the second language, not the base one.
*/
const DICTIONARIES = { id, en };

/*
  Always localStorage, never the session store the tokens use.

  Which language somebody reads in is a preference of this machine, not of this
  sign-in. Somebody who unticks "Remember me" should still find the app in
  Indonesian tomorrow.
*/
const LANG_KEY = 'lms_lang';

const readStoredLang = () => {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return LANGUAGES.includes(stored) ? stored : 'id';
  } catch {
    return 'id';
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(readStoredLang);

  /*
    The document's own language attribute, kept honest. Screen readers pick their
    voice from it, and browsers decide hyphenation and spellcheck by it — none of
    which follows from merely swapping the words on screen.
  */
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGUAGES.includes(next)) return;
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  }, []);

  /**
   * Look up a key, with `{name}` placeholders filled from `vars`.
   *
   * A missing key falls back to the English dictionary and then to the key
   * itself. Returning the key rather than empty text means a gap shows up as
   * `auth.signIn.title` on screen — ugly on purpose, because silent blanks are
   * how half-translated screens ship.
   */
  const t = useCallback(
    (key, vars) => {
      const raw = DICTIONARIES[lang]?.[key] ?? DICTIONARIES.en[key] ?? key;
      if (!vars) return raw;

      return Object.entries(vars).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        raw
      );
    },
    [lang]
  );

  const value = useMemo(() => ({ t, lang, setLang }), [t, lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/** @returns {{ t: (key: string, vars?: object) => string, lang: string, setLang: (l: string) => void }} */
export const useT = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useT must be used within a LanguageProvider');
  return context;
};

export default LanguageContext;
