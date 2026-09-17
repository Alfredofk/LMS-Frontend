import React from 'react';

/**
 * Reusable StatCard Component.
 * Displays metric totals with colored icon squares on the top right.
 */
export const StatCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  iconBg = 'bg-[#EDE9FE] text-[#7047EB]',
}) => {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between select-none hover:shadow-md hover:border-purple-100/60 transition-all duration-200">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-slate-500">
          {title}
        </span>
        {/* Top right icon badge wrapper */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {Icon && <Icon className="w-4 h-4" />}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
          {value}
        </div>
        <p className="text-[11px] text-slate-400 font-normal mt-2">
          {subtext}
        </p>
      </div>
  iconBg = 'bg-violet-50 text-violet-600',
}) => {
  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-6 shadow-sm flex items-start justify-between relative overflow-hidden select-none hover:shadow-md transition-shadow duration-200">
      <div className="space-y-1.5 text-left">
        <span className="text-xs font-bold text-slate-400">
          {title}
        </span>
        <div className="text-2xl font-black text-slate-800 tracking-tight mt-2">
          {value}
        </div>
        <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
          {subtext}
        </p>
      </div>

      {/* Top right icon badge wrapper */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${iconBg}`}>
        {Icon && <Icon className="w-4 h-4" />}
      </div>
    </div>
  );
};

export default StatCard;
