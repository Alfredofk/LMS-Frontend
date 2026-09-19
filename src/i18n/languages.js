/*
  The list of languages, alone in its own module.

  It lives here rather than beside the provider so `LanguageContext.jsx` exports
  nothing but its component and its hook — the shape `react-refresh` wants, and
  the same arrangement `AuthContext` uses for `useAuth`.

  Indonesian first: it is the default, and the switch renders in this order.
*/
export const LANGUAGES = ['id', 'en'];

export default LANGUAGES;
