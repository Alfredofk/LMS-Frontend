import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * One metric, with an icon square in the top right - always the brand's pale
 * purple (owner, 2026-10-07): one colour for every card, so the colour means
 * "a number", not a different meaning per card.
 *
 * A `<button>`, not a `<div onClick>`. It was the latter, wrapped from outside
 * by the dashboard — which meant the whole row of cards was invisible to the
 * keyboard and silent to a screen reader. Making the card itself the control
 * fixes both and removes the wrapper.
 *
 * `onClick` is optional: without it this renders as a plain, inert card.
 * `className` is for the card's place in a grid (a column span) only — never its
 * look, which this component owns (see CLAUDE.md, "A component's own class beats
 * its caller's").
 *
 * A card that leads somewhere says so on hover (owner, 2026-10-27, the skill
 * `.claude/skills/eduforid-design`): it lifts 2px, its shadow deepens and an
 * arrow slides in at the end of the subtext. An inert card does none of it.
 */

export const StatCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  onClick,
  className = '',
}) => {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`${className} w-full text-left bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between select-none transition-all duration-200 ${
        onClick
          ? 'group cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-brand/20 motion-reduce:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          : ''
      }`}
    >
      <div className="flex items-start justify-between w-full">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-brand-tint text-brand`}>
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
        <p className="flex items-end justify-between gap-1.5 text-[11px] text-slate-500 font-normal mt-2">
          <span className="min-w-0">{subtext}</span>
          {onClick && (
            <ArrowRight
              className="w-3.5 h-3.5 shrink-0 text-brand opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
              aria-hidden="true"
            />
          )}
        </p>
      </div>
    </Tag>
  );
};

export default StatCard;
