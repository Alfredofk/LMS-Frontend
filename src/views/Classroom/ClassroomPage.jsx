import React, { useState } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { classroomData } from './classroomData';
import ClassroomHeader from './components/ClassroomHeader';
import ClassroomTabs from './components/ClassroomTabs';
import MaterialContent from './components/MaterialContent';
import AssignmentContent from './components/AssignmentContent';
import MembersContent from './components/MembersContent';
import { useT } from '../../i18n/LanguageContext';
import NotBuiltYet from '../../components/ui/NotBuiltYet';

export const ClassroomPage = () => {
  const { t } = useT();
  const { showToast } = useOutletContext();
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('materi');

  // Locate the active subject schema matching URL, fallback to default
  const activeCourse = classroomData.find(c => c.id === courseId) || classroomData[0];

  /*
    One element, rendered by both branches below.

    The empty branch is the whole page today, so a title written only into the
    populated one would never appear. The Navbar names this route as well, but
    as a 12px breadcrumb that truncates — context, not a page title — so the key
    is borrowed from it and the markup is not.
  */
  const title = (
    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
      {t('shell.myCourses')}
    </h1>
  );

  /*
    The guard stays where it is: renderTabContent reads activeCourse.sections,
    and activeCourse is undefined while classroomData is empty.

    It is always empty today — there is no model for a lesson, a material or an
    assignment, and no route a student can ask for their subjects on — so this
    says the feature is not built rather than "no subjects yet", which would be
    a claim about the student's class.
  */
  if (classroomData.length === 0) {
    return (
      <div className="space-y-6">
        {title}
        <NotBuiltYet />
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
      {title}

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
