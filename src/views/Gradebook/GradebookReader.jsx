import React from 'react';
import { ArrowLeft, Lock } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import GradebookTable from './GradebookTable';

/*
  One class subject's gradebook, read only, opened in place (owner, 2026-10-11):
  for the Principal and Vice Principals from the Subjects timetable's
  ScheduleDialog, and for the homeroom teacher from HomeroomAttendance, beside
  "Lihat penilaian". The same table as the teacher's (GradebookTable) with its CSV;
  nothing in it opens or changes - the teacher of the subject marks and releases.

  @param classSubjectId  the class subject
  @param name            how it is called there ("MTK Matematika - XI IPS"), for the caption and the file
  @param onBack          () => void - back to what opened it
  @param showTitle       false where the host already heads it "Buku nilai"
*/
export const GradebookReader = ({ classSubjectId, name, onBack, showTitle = true }) => {
  const { t } = useT();
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        {t('tasm.reader.back')}
      </button>
      <div className="space-y-1">
        {showTitle && <p className="text-sm font-extrabold text-slate-900">{t('gradebook.readerTitle')}</p>}
        <p className="flex items-start gap-2 text-[11px] font-semibold text-slate-500 leading-relaxed">
          <Lock className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          {t('gradebook.readerNote')}
        </p>
      </div>
      <GradebookTable
        classSubjectId={classSubjectId}
        caption={name}
        fileName={`nilai-${name ?? ''}.csv`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-')}
        framed={false}
      />
    </div>
  );
};

export default GradebookReader;
