import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

import Button from '../../components/ui/Button';
import { LocationFields, TimeZoneField } from '../../components/SchoolPlaceFields';
import { schoolService } from '../../services/schoolService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { validateCoordinate, validateTimeZone, parseCoordinate, fieldErrorsFrom } from '../../utils/validation';

/*
  The school's point and time zone, for its Principal — on Settings.

  Backend 431513b and 0ad658f made both part of a school, required when a new
  one registers. A school registered before then has neither, and says so:
  `/users/me` tells every member `hasLocation` and the zone, and only a
  Principal the coordinates. Without a point there is no self check-in; without
  a zone there is no timetable. So the card opens with what is missing.

  Two routes, one form: `PATCH /school/location` and `PATCH /school/time-zone`.
  Saving sends only the half that changed. The fields are the registration
  form's own (components/SchoolPlaceFields.jsx).

  The sign-in membership is thin — no `location`, no `timeZone` — so the card
  reads `/users/me` once on mount, as ClassesPage does, and again after saving.
*/
const SchoolPlaceCard = ({ onToast }) => {
  const { membership, refreshMe } = useAuth();
  const { t } = useT();

  const asked = useRef(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [refreshMe]);

  const school = membership?.school ?? null;
  const saved = {
    latitude: school?.location?.latitude != null ? String(school.location.latitude) : '',
    longitude: school?.location?.longitude != null ? String(school.location.longitude) : '',
    timeZone: school?.timeZone ?? '',
  };

  /* null until the reader edits: the form shows what is saved until then. */
  const [draft, setDraft] = useState(null);
  const values = draft ?? saved;
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const change = (name, value) => {
    setDraft((prev) => ({ ...(prev ?? saved), [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  const pointChanged =
    values.latitude !== saved.latitude || values.longitude !== saved.longitude;
  const zoneChanged = values.timeZone !== saved.timeZone;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    const next = {};
    for (const kind of ['latitude', 'longitude']) {
      const fail = validateCoordinate(kind, values[kind]);
      if (fail) next[kind] = t(fail.key, fail.vars);
    }
    const zoneFail = validateTimeZone(values.timeZone);
    if (zoneFail) next.timeZone = t(zoneFail.key);
    if (Object.keys(next).length === 0 && !pointChanged && !zoneChanged) next.global = t('classes.edit.nothing');
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSaving(true);
    try {
      if (pointChanged) {
        await schoolService.updateLocation({
          latitude: parseCoordinate(values.latitude),
          longitude: parseCoordinate(values.longitude),
        });
      }
      if (zoneChanged) await schoolService.updateTimeZone(values.timeZone);
      await refreshMe().catch(() => {});
      setDraft(null);
      onToast?.(t('place.saved'), 'success');
    } catch (err) {
      const fields = fieldErrorsFrom(err.details, ['latitude', 'longitude', 'timeZone']);
      setErrors(Object.keys(fields).length ? fields : { global: apiErrorMessage(err, t) });
    } finally {
      setIsSaving(false);
    }
  };

  const missing = [
    !school?.hasLocation && t('place.missing.location'),
    !school?.timeZone && t('place.missing.timeZone'),
  ].filter(Boolean);

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4 text-left">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
          <MapPin className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('place.card.title')}</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
            {t('place.card.body', { school: school?.name ?? '' })}
          </p>
        </div>
      </div>

      {loaded && missing.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 leading-relaxed" role="status">
          {t('place.missing', { what: missing.join(t('place.missing.and')) })}
        </div>
      )}

      {!loaded ? (
        <div className="h-40 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <LocationFields idPrefix="school" values={values} errors={errors} onChange={change} />
          <TimeZoneField
            id="schoolTimeZone"
            value={values.timeZone}
            error={errors.timeZone || undefined}
            onChange={(value) => change('timeZone', value)}
          />
          {/* Once a zone is saved, changing it moves the timetable (backend 7cdc46d,
              onTimeZoneChanged): meetings from tomorrow keep their clock time in the
              new zone, and today's and past ones stay. Said before the press. */}
          {saved.timeZone && (
            <p className="-mt-2 text-[11px] font-semibold text-slate-500 leading-relaxed">{t('place.timeZone.changeNote')}</p>
          )}

          {errors.global && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
              {errors.global}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            {draft && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setErrors({});
                }}
                isDisabled={isSaving}
              >
                {t('common.cancel')}
              </Button>
            )}
            <Button type="submit" isLoading={isSaving}>
              {t('classes.edit.save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};

export default SchoolPlaceCard;
