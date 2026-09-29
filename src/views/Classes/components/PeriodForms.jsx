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
  yearHoldsSemesters,
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

/* An API date ("2028-08-18T00:00:00.000Z") as a date input wants it. */
const dayOf = (value) => (value ? String(value).slice(0, 10) : '');

const useDateRange = (initial) => {
  const [values, setValues] = useState({ startDate: dayOf(initial?.startDate), endDate: dayOf(initial?.endDate) });
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
 * A new academic year — or, given `initial`, a correction to one.
 *
 * Several may be ACTIVE at once — next year can be set up before this one
 * closes — so a new one is offered whether or not one exists.
 *
 * **An ACTIVE year can be corrected since backend `f669286`**, label and dates,
 * as long as the dates still hold every semester in it (`yearHoldsSemesters`).
 * Until then a year created as "2028/2029, 18 Aug – 18 Sep 2028" (it happened)
 * was stuck that way, which is why the dates are checked against the label
 * (`yearDatesMatchLabel`) and the press is confirmed with the whole year spelled
 * out — its length too, with a warning outside 9–13 months. Both stay: a CLOSED
 * year still cannot be changed, and the label stays unique per school forever.
 *
 * Editing sends only what changed; the server refuses an empty change.
 */
export const AcademicYearForm = ({ onCreated, onCancel, initial = null, onSaved }) => {
  const { t, lang } = useT();
  const editing = Boolean(initial);
  const { values, errors, setErrors, change } = useDateRange(initial);
  const [label, setLabel] = useState(initial?.label ?? '');
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
    if (editing && !next.startDate && !next.endDate && !range.start && !range.end) {
      const held = yearHoldsSemesters(initial, values.startDate, values.endDate);
      if (held) {
        /* On the side that moved past a semester: a start too late, else the end. */
        const startTooLate = yearHoldsSemesters(initial, values.startDate, '9999-12-31');
        next[startTooLate ? 'startDate' : 'endDate'] = t(held.key, held.vars);
      }
    }
    if (editing && Object.keys(next).length === 0 && Object.keys(changes()).length === 0) {
      next.global = t('classes.edit.nothing');
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setConfirming(true);
  };

  /* What differs from the year as it stands — all of it, for a new one. */
  const changes = () => {
    const body = { label: label.trim(), startDate: values.startDate, endDate: values.endDate };
    if (!editing) return body;
    if (body.label === initial.label) delete body.label;
    if (body.startDate === dayOf(initial.startDate)) delete body.startDate;
    if (body.endDate === dayOf(initial.endDate)) delete body.endDate;
    return body;
  };

  const months = values.startDate && values.endDate ? monthsBetween(values.startDate, values.endDate) : 0;

  const create = async () => {
    setIsWorking(true);
    try {
      const year = editing
        ? await academicsService.updateAcademicYear(initial.id, changes())
        : await academicsService.createAcademicYear(changes());
      setConfirming(false);
      (editing ? onSaved : onCreated)(year);
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
        id={editing ? 'yearLabelEdit' : 'yearLabel'}
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
          id={editing ? 'yearStartEdit' : 'yearStart'}
          name="startDate"
          label={t('classes.field.startDate')}
          type="date"
          value={values.startDate}
          error={errors.startDate || undefined}
          onChange={change('startDate')}
        />
        <Input
          id={editing ? 'yearEndEdit' : 'yearEnd'}
          name="endDate"
          label={t('classes.field.endDate')}
          type="date"
          value={values.endDate}
          error={errors.endDate || undefined}
          onChange={change('endDate')}
        />
      </div>

      <GlobalError message={errors.global} />
      <Actions
        onCancel={onCancel}
        isWorking={isWorking}
        submitLabel={t(editing ? 'classes.edit.save' : 'classes.year.create')}
      />

      <ConfirmDialog
        open={confirming}
        tone="brand"
        title={t(editing ? 'classes.year.edit.confirmTitle' : 'classes.year.confirm.title', { label: label.trim() })}
        body={
          t('classes.year.confirm.body', {
            start: formatDay(values.startDate, lang),
            end: formatDay(values.endDate, lang),
            months,
          }) + (isUsualYearLength(months) ? '' : ' ' + t('classes.year.confirm.unusual', { months }))
        }
        confirmLabel={t(editing ? 'classes.edit.save' : 'classes.year.create')}
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
 * Semester 1 or 2 of one year — or, given `initial`, a correction to one. The
 * dates must sit inside the year and clear of the other half; the year's own
 * range is shown so nobody has to guess it.
 *
 * An OPEN semester's dates and deadline can be corrected since backend
 * `f669286`; its ordinal never changes. A deadline emptied is sent as null,
 * which removes it.
 */
export const SemesterForm = ({ year, ordinal, onCreated, onCancel, initial = null, onSaved }) => {
  const { t, lang } = useT();
  const editing = Boolean(initial);
  const { values, errors, setErrors, change } = useDateRange(initial);
  /* Optional (ticket 08): from this day on, only the Principal assigns teachers. */
  const [deadline, setDeadline] = useState(dayOf(initial?.classSubjectRegistrationDeadline));
  const [isWorking, setIsWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  /*
    Checked against the year and the other semester here (`semesterFits` — it
    skips this semester's own ordinal, so an edit is not measured against
    itself), and the press is confirmed with the dates spelled out.
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
    if (editing && Object.keys(next).length === 0 && Object.keys(changes()).length === 0) {
      next.global = t('classes.edit.nothing');
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setConfirming(true);
  };

  /* What differs from the semester as it stands; an emptied deadline is null. */
  const changes = () => {
    if (!editing) {
      return {
        ordinal,
        startDate: values.startDate,
        endDate: values.endDate,
        ...(deadline ? { classSubjectRegistrationDeadline: deadline } : {}),
      };
    }
    const body = {};
    if (values.startDate !== dayOf(initial.startDate)) body.startDate = values.startDate;
    if (values.endDate !== dayOf(initial.endDate)) body.endDate = values.endDate;
    if (deadline !== dayOf(initial.classSubjectRegistrationDeadline)) {
      body.classSubjectRegistrationDeadline = deadline || null;
    }
    return body;
  };

  const create = async () => {
    setIsWorking(true);
    try {
      const updated = editing
        ? await academicsService.updateSemester(initial.id, changes())
        : await academicsService.createSemester(year.id, changes());
      setConfirming(false);
      (editing ? onSaved : onCreated)(updated);
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
          id={`semester${ordinal}Start${editing ? 'Edit' : ''}`}
          name="startDate"
          label={t('classes.field.startDate')}
          type="date"
          value={values.startDate}
          error={errors.startDate || undefined}
          onChange={change('startDate')}
        />
        <Input
          id={`semester${ordinal}End${editing ? 'Edit' : ''}`}
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
          id={`semester${ordinal}Deadline${editing ? 'Edit' : ''}`}
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
        submitLabel={editing ? t('classes.edit.save') : t('classes.semester.create', { n: ordinal })}
      />

      <ConfirmDialog
        open={confirming}
        tone="brand"
        title={t(editing ? 'classes.semester.edit.confirmTitle' : 'classes.semester.confirm.title', { n: ordinal, label: year.label })}
        body={`${t('classes.semester.confirm.body', {
          start: formatDay(values.startDate, lang),
          end: formatDay(values.endDate, lang),
        })} ${
          deadline
            ? t('classes.semester.confirm.deadline', { date: formatDay(deadline, lang) })
            : t('classes.semester.confirm.noDeadline')
        }`}
        confirmLabel={editing ? t('classes.edit.save') : t('classes.semester.create', { n: ordinal })}
        cancelLabel={t('classes.year.confirm.back')}
        busy={isWorking}
        busyLabel={t('common.loading')}
        onCancel={() => setConfirming(false)}
        onConfirm={create}
      />
    </form>
  );
};
