import React, { useState } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { classroomData } from './classroomData';
import ClassroomHeader from './components/ClassroomHeader';
import ClassroomTabs from './components/ClassroomTabs';
import MaterialContent from './components/MaterialContent';
import AssignmentContent from './components/AssignmentContent';
import MembersContent from './components/MembersContent';
import { useT } from '../../i18n/LanguageContext';

export const ClassroomPage = () => {
  const { t } = useT();
  const { showToast } = useOutletContext();
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('materi');

  // Locate the active subject schema matching URL, fallback to default
  const activeCourse = classroomData.find(c => c.id === courseId) || classroomData[0];

  if (classroomData.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-100 rounded-2xl p-6 shadow-sm select-none">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-400 mb-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <p className="text-sm font-extrabold text-slate-900">
          {t('cls.empty')}
        </p>
        <p className="text-xs text-slate-400 font-bold mt-1 max-w-sm leading-relaxed">
          {t('cls.emptyDetail')}
        </p>
      </div>
    );
  }

  // Render view panel dynamically depending on active tab ID
  const renderTabContent = () => {
    switch (activeTab) {
      case 'materi':
        return <MaterialContent sections={activeCourse.sections} showToast={showToast} />;
      case 'tugas':
        return <AssignmentContent sections={activeCourse.sections} showToast={showToast} />;
      case 'anggota':
        return <MembersContent />;
      default:
        return <MaterialContent sections={activeCourse.sections} showToast={showToast} />;
    }
  };

  return (
    <div className="space-y-6">

      {/* Subject Capsule Switcher Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200/20 select-none">
          {classroomData.map((course) => {
            const isSelected = course.id === activeCourse.id;
            return (
              <button
                key={course.id}
                onClick={() => navigate(`/classroom/${course.id}`)}
                className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer focus:outline-none
                  ${isSelected
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }
                `}
              >
                {course.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Classroom Top Banner */}
      <ClassroomHeader course={activeCourse} />

      {/* 2. Horizontal Navigation Tabs */}
      <ClassroomTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 3. Render View Panel Content */}
      <div className="pt-2">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ClassroomPage;
