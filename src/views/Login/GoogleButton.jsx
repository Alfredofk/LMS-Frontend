import React, { useEffect, useRef, useState } from 'react';

import { useT } from '../../i18n/LanguageContext';

/*
  Google's own button, rendered by Google Identity Services.

  It is their button rather than ours on purpose: the ID-token flow expects it,
  their branding rules require it, and it writes its own wording, focus and
  pressed states. The cost is that it comes with Google's own markup and inline
  width, so index.css has to overrule both to make it sit level with the buttons
  around it.

  The script is injected here rather than from index.html because only this
  screen needs it. Every other page in the app would otherwise reach out to
  Google for nothing.

  What comes back through `callback` is `{ credential }` — the ID token. It goes
  straight to the backend, which verifies Google's signature, the expiry, the
  issuer and the audience before it trusts a word of it. Nothing here inspects
  it, and nothing here could: a token this file believed would be a token an
  attacker could write.
*/

const SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/*
  One script for the whole page, however many times this mounts — but tied to
  the language it was loaded for.

  Google resolves their button's wording **once, as the script loads**, from the
  `hl` query parameter on its URL. `locale` on renderButton is accepted and then
  ignored: asking for 'en', 'fr' or 'ja' on a library already loaded gives the
  same words every time. Measured, not assumed — without `hl` this button read
  "Lanjutkan dengan Google" on an en-US browser showing an English page.

  So changing language means loading their library again. That is heavier than a
  re-render, which is why it only happens when the language actually changes.
*/
let loaded = null;

function loadGoogleScript(lang) {
  if (loaded?.lang === lang) return loaded.promise;

  if (loaded) {
    document.querySelectorAll(`script[src^="${SRC}"]`).forEach((s) => s.remove());
    delete window.google;
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${SRC}?hl=${encodeURIComponent(lang)}`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('blocked')), { once: true });
    document.head.appendChild(script);
  });

  /* A failure must not be remembered, or a blocked first attempt would be the
     answer for the rest of the page's life. */
  promise.catch(() => {
    if (loaded?.promise === promise) loaded = null;
  });

  loaded = { lang, promise };
  return promise;
}

const Note = ({ children }) => (
  <p className="text-[11px] text-slate-500 font-semibold text-center">{children}</p>
);

/**
 * @param {(idToken: string) => void} onCredential  called with the ID token
 * @param {boolean} disabled  true while a sign-in is already in flight
 * @param {'continue_with'|'signup_with'|'signin_with'|'signin'} [text]
 *   Google's own wording, which they translate — `signup_with` reads "Daftar
 *   dengan Google" or "Sign up with Google" depending on the language loaded.
 */
export const GoogleButton = ({ onCredential, disabled, text = 'continue_with' }) => {
  const { t, lang } = useT();
  const target = useRef(null);
  const [state, setState] = useState(CLIENT_ID ? 'loading' : 'unconfigured');

  /*
    The callback is read through a ref so that re-rendering — which happens on
    every keystroke in the form beside this — never re-initialises Google's
    library. Passing it directly would mean tearing the button down and building
    it again as somebody types their email.
  */
  const latest = useRef(onCredential);

  useEffect(() => {
    latest.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;

    let cancelled = false;

    loadGoogleScript(lang)
      .then(() => {
        if (cancelled || !target.current) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: ({ credential }) => credential && latest.current?.(credential),
        });

        /*
          Google appends into this container rather than replacing what is in
          it, so switching between sign-up and sign-in would leave two buttons
          stacked. Clear it first.
        */
        target.current.replaceChildren();

        window.google.accounts.id.renderButton(target.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          /*
            Rectangular rather than pill because index.css rounds this to 16px to
            match everything else on the card, and starting from a box means
            less to overrule.

            400 is the widest Google honours — beyond that the number lands in
            the inline style and the layout ignores it. CSS stretches the button
            the rest of the way; this value is what shows if that ever stops
            working.
          */
          shape: 'rectangular',
          logo_alignment: 'center',
          width: 400,
          /*
            No `locale` here on purpose — see loadGoogleScript. The language
            rides on the script URL instead, because that is the only place
            their library reads it.
          */
        });

        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('blocked');
      });

    return () => {
      cancelled = true;
    };
    /*
      `text` alone. Switching between sign-up and sign-in is a real reason to
      draw the button again — the wording has to follow the form. Typing an
      email is not, which is why the credential callback stays behind a ref
      instead of sitting in here. `lang` joins it for the same reason: the
      button's own wording has to follow the language, and on this one their
      library has to be loaded again for that to happen.
    */
  }, [text, lang]);

  /*
    Every failure here is a configuration or network problem, never the person's
    fault — so each one says what is actually wrong instead of leaving a button
    that does nothing when pressed.
  */
  if (state === 'unconfigured') {
    return <Note>{t('google.unconfigured')}</Note>;
  }

  if (state === 'blocked') {
    return <Note>{t('google.blocked')}</Note>;
  }

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      {/* google-button is defined in index.css — it is what makes this sit level
          with the Continue button. min-h keeps the layout still while Google's
          script is on its way. */}
      <div ref={target} className="google-button flex justify-center min-h-[44px]" />
      {state === 'loading' && <Note>{t('google.loading')}</Note>}
    </div>
  );
};

export default GoogleButton;
