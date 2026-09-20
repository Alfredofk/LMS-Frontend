import React from 'react';

/**
 * One metric, with a coloured icon square in the top right.
 *
 * A `<button>`, not a `<div onClick>`. It was the latter, wrapped from outside
 * by the dashboard — which meant the whole row of cards was invisible to the
 * keyboard and silent to a screen reader. Making the card itself the control
 * fixes both and removes the wrapper.
 *
 * `onClick` is optional: without it this renders as a plain, inert card.
 */
export const StatCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  iconBg = 'bg-brand-tint text-brand',
  onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between select-none transition-all duration-200 ${
        onClick
          ? 'cursor-pointer hover:shadow-md hover:border-purple-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          : ''
      }`}
    >
      <div className="flex items-start justify-between w-full">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
        </div>
      </div>

      <div className="mt-3 w-full">
        {/* extrabold, matching every other card's headline number in the app —
            at font-bold this card read visibly lighter than its neighbours. The
            label above and the subtext below stay lighter on purpose. */}
        <div className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
          {value}
        </div>
        <p className="text-[11px] text-slate-400 font-normal mt-2">{subtext}</p>
      </div>
    </Tag>
  );
};

export default StatCard;
