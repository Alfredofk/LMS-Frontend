import React, { createContext, useContext, useEffect, useState } from 'react';

import { schoolService } from '../services/schoolService';
import { subdomainOf } from '../constants/subdomain';

/*
  Whose address this is (backend a577abd; owner 2026-10-22). On the main domain, or
  with school addresses off, there is nothing to ask: `{ status: 'main' }`. On a
  school's own address the label is read from the hostname and asked once
  (`GET /places/:subdomain`, public): `loading`, then `found` with `{ name,
  schoolType }`, or `unknown` for a label nobody uses or a school switched off (the
  same 404) - PlaceGate shows that instead of the app. A failed read that is not a
  404 lets the app on (`found` with no place): the sign-in itself still names the
  school.
*/

const PlaceContext = createContext({ status: 'main', label: null, place: null });

export const PlaceProvider = ({ children }) => {
  const [label] = useState(() => subdomainOf(window.location.hostname));
  const [state, setState] = useState(() => (label ? { status: 'loading', place: null } : { status: 'main', place: null }));

  useEffect(() => {
    if (!label) return undefined;
    let cancelled = false;
    schoolService
      .resolvePlace(label)
      .then((place) => !cancelled && setState({ status: 'found', place }))
      .catch((err) => !cancelled && setState({ status: err?.status === 404 ? 'unknown' : 'found', place: null }));
    return () => {
      cancelled = true;
    };
  }, [label]);

  return <PlaceContext.Provider value={{ ...state, label }}>{children}</PlaceContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePlace = () => useContext(PlaceContext);
