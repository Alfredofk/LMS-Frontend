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
    </div>
  );
};

export default StatCard;
