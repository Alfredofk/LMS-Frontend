import React from 'react';

/**
 * The EduForID mark: a stacked diamond in a rounded square.
 *
 * It was drawn three times over — once for the sign-in card, once for the
 * sidebar, and it was about to be drawn a third time for the landing page.
 * Same glyph every time; only the size and the two colours differed, so those
 * are what this takes as props.
 *
 * @param {'sm'|'md'|'lg'} [size]
 * @param {'solid'|'soft'} [tone]  solid: purple square, white glyph.
 *                                 soft: lavender square, purple glyph.
 */
const SIZES = {
  sm: { box: 'w-8 h-8 rounded-lg', glyph: 'w-4 h-4' },
  md: { box: 'w-9 h-9 rounded-xl', glyph: 'w-5 h-5' },
  lg: { box: 'w-16 h-16 rounded-2xl', glyph: 'w-8 h-8' },
};

const TONES = {
  solid: 'bg-[#7047EB] text-white shadow-md shadow-purple-500/20',
  soft: 'bg-[#F1EEFF] text-[#7047EB] shadow-sm',
};

export const BrandMark = ({ size = 'md', tone = 'solid', className = '' }) => {
  const { box, glyph } = SIZES[size] ?? SIZES.md;

  return (
    <div
      className={`${box} ${TONES[tone] ?? TONES.solid} flex items-center justify-center shrink-0 ${className}`}
    >
      {/* currentColor throughout, so the tone above is the only thing that
          decides how this is painted. */}
      <svg className={glyph} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 4L4 10L12 16L20 10L12 4Z" fill="currentColor" fillOpacity="0.9" />
        <path d="M7 13.5L12 17.5L17 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export default BrandMark;
