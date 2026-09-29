import React, { useState } from 'react';
import { LocateFixed } from 'lucide-react';

import Input from './ui/Input';
import SelectField from './ui/SelectField';
import { useT } from '../i18n/LanguageContext';
import { TIME_ZONES, splitCoordinatePair } from '../utils/validation';

/*
  Where a school is, and which clock it keeps — backend 431513b and 0ad658f.
  Used when founding a school and when its Principal corrects either.

  **The point** is for a student's self check-in: the server compares a check-in
  against it, and without one there is no self check-in at all. Two boxes, since
  that is what the backend takes, and two ways to fill them without typing:

    - "Use my current location" — the browser's geolocation, offered only where
      the browser allows it (a secure context: https, or localhost). Over a LAN
      address such as http://10.20.x.x it does not exist, and the button is not
      shown rather than failing.
    - A pair pasted into the latitude box ("-7.9666, 112.6326", as Google Maps
      copies it) is split across both.

  **The time zone is chosen, never guessed from the point**: the WIB/WITA line
  follows provinces, not a meridian (school.schema.js). So there is no default —
  a school in Balikpapan must not be quietly filed as WIB.

  Controlled: `values` holds `latitude`, `longitude` and `timeZone` as strings,
  `onChange(name, value)` reports each, `errors` holds sentences.
*/

const ZONE_KEYS = { WIB: 'place.timeZone.WIB', WITA: 'place.timeZone.WITA', WIT: 'place.timeZone.WIT' };

const canLocate = () =>
  typeof window !== 'undefined' && window.isSecureContext && typeof navigator !== 'undefined' && 'geolocation' in navigator;

export const LocationFields = ({ values, errors = {}, onChange, idPrefix = 'place' }) => {
  const { t } = useT();
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);

  const locate = () => {
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        /* Six decimals is about 10 cm — far finer than a check-in radius needs. */
        onChange('latitude', position.coords.latitude.toFixed(6));
        onChange('longitude', position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setLocateError(t(err.code === 1 ? 'place.locate.denied' : 'place.locate.failed'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id={`${idPrefix}Latitude`}
          name="latitude"
          label={t('place.latitude')}
          placeholder="-7.966620"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={values.latitude ?? ''}
          error={errors.latitude || undefined}
          onChange={(e) => onChange('latitude', e.target.value)}
          onPaste={(e) => {
            const pair = splitCoordinatePair(e.clipboardData?.getData('text'));
            if (!pair) return;
            e.preventDefault();
            onChange('latitude', pair.latitude);
            onChange('longitude', pair.longitude);
          }}
        />
        <Input
          id={`${idPrefix}Longitude`}
          name="longitude"
          label={t('place.longitude')}
          placeholder="112.632632"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={values.longitude ?? ''}
          error={errors.longitude || undefined}
          onChange={(e) => onChange('longitude', e.target.value)}
        />
      </div>

      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('place.hint')}</p>

      {canLocate() && (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-deep disabled:text-slate-500 cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          <LocateFixed className="w-4 h-4" aria-hidden="true" />
          {t(locating ? 'place.locate.busy' : 'place.locate')}
        </button>
      )}
      {locateError && (
        <p className="text-xs text-red-500 font-medium" role="alert">
          {locateError}
        </p>
      )}
    </div>
  );
};

export const TimeZoneField = ({ value, error, onChange, id = 'timeZone' }) => {
  const { t } = useT();
  return (
    <div className="space-y-1.5">
      <SelectField id={id} label={t('place.timeZone')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} error={error}>
        <option value="">{t('place.timeZone.choose')}</option>
        {TIME_ZONES.map((zone) => (
          <option key={zone} value={zone}>
            {t(ZONE_KEYS[zone])}
          </option>
        ))}
      </SelectField>
      {!error && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('place.timeZone.hint')}</p>}
    </div>
  );
};
