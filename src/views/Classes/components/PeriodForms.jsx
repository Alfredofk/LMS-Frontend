import React, { useState } from 'react';

import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { academicsService } from '../../../services/academicsService';
import { useT } from '../../../i18n/LanguageContext';
import { academicsErrorMessage } from '../../../i18n/apiError';
import {
  validateAcademicYearLabel,
  validateDateRange,
  yearDatesMatchLabel,
  semesterFits,
  deadlineFits,
  monthsBetween,
  isUsualYearLength,
  fieldErrorsFrom,
} from '../../../utils/validation';
import { formatDay, suggestedYearLabel } from '../format';

/*
  The two periods a Principal names: an academic year, and each of its halves.

  Both are "a start and an end, the end strictly later" — the same refine in
  `academics.schema.js` for either — so they share the date pair and the way a
  server refusal comes back. What only the database knows (a label already
  taken, a semester outside its year or overlapping the other one) arrives as a
  sentence from `academicsErrorMessage`, not as a guess made here.
*/

const DATE_FIELDS = ['startDate', 'endDate'];

const useDateRange = () => {
  const [values, setValues] = useState({ startDate: '', endDate: '' });
  const [errors, setErrors] = useState({});

  const change = (name) => (e) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  return { values, setValues, errors, setErrors, change };
};

const GlobalError = ({ message }) =>
  message ? (
    <div
      className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold"
      role="alert"
    >
      {message}
    </div>
  ) : null;

const Actions = ({ onCancel, isWorking, submitLabel }) => {
  const { t } = useT();
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} isDisabled={isWorking}>
          {t('common.cancel')}
        </Button>
      )}
      <Button type="submit" isLoading={isWorking}>
        {submitLabel}
      </Button>
    </div>
  );
};

/**
 * A new academic year. Several may be ACTIVE at once — next year can be set up
 * before this one closes — so this is offered whether or not one exists.
 *
 * **Nothing about a year can be changed once it exists**: the backend has no
 * route to edit or delete one, its label is unique per school, and every
 * semester must fit inside its dates. A year created as "2028/2029, 18 Aug –
 * 18 Sep 2028" (it happened) is stuck that way. So the dates are checked against
 * the label (`yearDatesMatchLabel`), and the press is confirmed with the whole
 * year spelled out — its length too, with a warning outside 9–13 months.
 */
export const AcademicYearForm = ({ onCreated, onCancel }) => {
  const { t, lang } = useT();
  const { values, errors, setErrors, change } = useDateRange();
  const [label, setLabel] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isWorking) return;

    const next = {};
    const labelFail = validateAcademicYearLabel(label);
    if (labelFail) next.label = t(labelFail.key, labelFail.vars);
    const range = validateDateRange(values.startDate, values.endDate);
    if (range.start) next.startDate = t(range.start.key);
    if (range.end) next.endDate = t(range.end.key);
    if (!labelFail && !range.start && !range.end) {
      const match = yearDatesMatchLabel(label, values.startDate, values.endDate);
      if (match.start) next.startDate = t(match.start.key, match.start.vars);
      if (match.end) next.endDate = t(match.end.key, match.end.vars);
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setConfirming(true);
  };

  const months = values.startDate && values.endDate ? monthsBetween(values.startDate, values.endDate) : 0;

  const create = async () => {
    setIsWorking(true);
    try {
      const year = await academicsService.createAcademicYear({
        label: label.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      });
      setConfirming(false);
      onCreated(year);
    } catch (err) {
      setConfirming(false);
      const fields = fieldErrorsFrom(err.details, ['label', ...DATE_FIELDS]);
      setErrors(Object.keys(fields).length ? fields : { global: academicsErrorMessage(err, t) });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
      <Input
        id="yearLabel"
        name="label"
        label={t('classes.year.field.label')}
        placeholder={suggestedYearLabel()}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={label}
        error={errors.label || undefined}
        onChange={(e) => {
          setLabel(e.target.value);
          setErrors((prev) => ({ ...prev, label: null, global: null }));
        }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="yearStart"
          name="startDate"
          label={t('classes.field.startDate')}
          type="date"
          value={values.startDate}
          error={errors.startDate || undefined}
          onChange={change('startDate')}
        />
        <Input
          id="yearEnd"
          name="endDate"
          label={t('classes.field.endDate')}
          type="date"
          value={values.endDate}
          error={errors.endDate || undefined}
          onChange={change('endDate')}
        />
      </div>

      <GlobalError message={errors.global} />
      <Actions onCancel={onCancel} isWorking={isWorking} submitLabel={t('classes.year.create')} />

      <ConfirmDialog
        open={confirming}
        tone="brand"
        title={t('classes.year.confirm.title', { label: label.trim() })}
        body={
          t('classes.year.confirm.body', {
            start: formatDay(values.startDate, lang),
            end: formatDay(values.endDate, lang),
            months,
          }) + (isUsualYearLength(months) ? '' : ' ' + t('classes.year.confirm.unusual', { months }))
        }
        confirmLabel={t('classes.year.create')}
        cancelLabel={t('classes.year.confirm.back')}
        busy={isWorking}
        busyLabel={t('common.loading')}
        onCancel={() => setConfirming(false)}
        onConfirm={create}
      />
    </form>
  );
};

/**
 * Semester 1 or 2 of one year. The dates must sit inside the year and clear of
 * the other half; the year's own range is shown so nobody has to guess it.
 */
export const SemesterForm = ({ year, ordinal, onCreated, onCancel }) => {
  const { t, lang } = useT();
  const { values, errors, setErrors, change } = useDateRange();
  /* Optional (ticket 08): from this day on, only the Principal assigns teachers. */
  const [deadline, setDeadline] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  /*
    Like the year: a semester cannot be edited or deleted once it exists, so its
    dates are checked against the year and the other semester here
    (`semesterFits`), and the press is confirmed with the dates spelled out.
  */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isWorking) return;

    const range = validateDateRange(values.startDate, values.endDate);
    const next = {};
    if (range.start) next.startDate = t(range.start.key);
    if (range.end) next.endDate = t(range.end.key);
    if (!range.start && !range.end) {
      const fits = semesterFits(year, ordinal, values.startDate, values.endDate);
      if (fits.start) next.startDate = t(fits.start.key, fits.start.vars);
      if (fits.end) next.endDate = t(fits.end.key, fits.end.vars);
      const late = deadlineFits(values.startDate, values.endDate, deadline);
      if (late) next.deadline = t(late.key);
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setConfirming(true);
  };

  const create = async () => {
    setIsWorking(true);
    try {
      const updated = await academicsService.createSemester(year.id, {
        ordinal,
        startDate: values.startDate,
        endDate: values.endDate,
        ...(deadline ? { classSubjectRegistrationDeadline: deadline } : {}),
      });
      setConfirming(false);
      onCreated(updated);
    } catch (err) {
      setConfirming(false);
      if (String(err?.message ?? '').includes('registration deadline must fall inside')) {
        setErrors({ deadline: t('validation.deadline.outside') });
        return;
      }
      const fields = fieldErrorsFrom(err.details, DATE_FIELDS);
      setErrors(Object.keys(fields).length ? fields : { global: academicsErrorMessage(err, t) });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
      <p className="text-xs text-slate-500 font-semibold leading-relaxed">
        {t('classes.semester.within', {
          label: year.label,
          start: formatDay(year.startDate, lang),
          end: formatDay(year.endDate, lang),
        })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id={`semester${ordinal}Start`}
          name="startDate"
          label={t('classes.field.startDate')}
          type="date"
          value={values.startDate}
          error={errors.startDate || undefined}
          onChange={change('startDate')}
        />
        <Input
          id={`semester${ordinal}End`}
          name="endDate"
          label={t('classes.field.endDate')}
          type="date"
          value={values.endDate}
          error={errors.endDate || undefined}
          onChange={change('endDate')}
        />
      </div>
      <div className="space-y-1.5">
        <Input
          id={`semester${ordinal}Deadline`}
          name="classSubjectRegistrationDeadline"
          label={t('classes.semester.deadline')}
          type="date"
          value={deadline}
          error={errors.deadline || undefined}
          onChange={(e) => {
            setDeadline(e.target.value);
            if (errors.deadline) setErrors((prev) => ({ ...prev, deadline: null }));
          }}
        />
        {!errors.deadline && (
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('classes.semester.deadlineHint')}</p>
        )}
      </div>

      <GlobalError message={errors.global} />
      <Actions
        onCancel={onCancel}
        isWorking={isWorking}
        submitLabel={t('classes.semester.create', { n: ordinal })}
      />

      <ConfirmDialog
        open={confirming}
        tone="brand"
        title={t('classes.semester.confirm.title', { n: ordinal, label: year.label })}
        body={`${t('classes.semester.confirm.body', {
          start: formatDay(values.startDate, lang),
          end: formatDay(values.endDate, lang),
        })} ${
          deadline
            ? t('classes.semester.confirm.deadline', { date: formatDay(deadline, lang) })
            : t('classes.semester.confirm.noDeadline')
        }`}
        confirmLabel={t('classes.semester.create', { n: ordinal })}
        cancelLabel={t('classes.year.confirm.back')}
        busy={isWorking}
        busyLabel={t('common.loading')}
        onCancel={() => setConfirming(false)}
        onConfirm={create}
      />
    </form>
  );
};
