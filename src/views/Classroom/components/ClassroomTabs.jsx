import React from 'react';
import { BookOpen, FileText, Users } from 'lucide-react';

export const ClassroomTabs = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'materi', label: 'Materi', icon: BookOpen },
    { id: 'tugas', label: 'Tugas & Kuis', icon: FileText },
    { id: 'anggota', label: 'Anggota Kelas', icon: Users },
  ];

  return (
    <div className="border-b border-slate-200 select-none">
      <div className="flex gap-6 -mb-px">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3.5 px-1.5 border-b-2 text-sm font-black transition-all duration-300 ease-in-out focus:outline-none cursor-pointer
                ${isActive 
                  ? 'border-[#7047EB] text-[#7047EB]' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                }
              `}
            >
              <TabIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#7047EB]' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ClassroomTabs;
