import React from 'react';

import LanguageSwitch from '../components/ui/LanguageSwitch';

/**
 * The purple-and-white shell every signed-out screen wears.
 *
 * It was copied whole into /select-role and /verify-email before
 * this existed — three identical forty-line blocks, about to become five. Every
 * one of them is the same thing: a purple column carrying one sentence of
 * reassurance, and a white card carrying the actual work.
 *
 * @param {string} heading   the large line in the purple column
 * @param {string} blurb     one sentence under it
 * @param {React.ReactNode} children  the contents of the white card
 * @param {React.ReactNode} [footer]  pinned to the bottom of the white card
 */
export const AuthLayout = ({ heading, blurb, children, footer }) => (
  <div className="min-h-screen lg:h-screen w-screen bg-[#6D43EC] flex flex-col lg:flex-row font-sans selection:bg-violet-500 selection:text-white relative lg:overflow-hidden">

    {/* --- PURPLE COLUMN --- */}
    <div className="w-full text-white flex flex-col justify-between p-8 sm:p-12 relative shrink-0 z-0 text-left select-none bg-[#6D43EC] lg:w-[35%] lg:h-full lg:order-1 lg:overflow-hidden">
      {/* The switch lives in this column because it is visible at every width —
          stacked above the card on a phone, beside it on a desktop. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xl font-black tracking-tight">EduForID</span>
        <LanguageSwitch tone="dark" />
      </div>

      <div className="relative my-auto space-y-6 max-w-sm z-10 shrink-0">
        <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
          {heading}
        </h2>
        <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-medium">
          {blurb}
        </p>
      </div>

      {/* Hidden below lg: stacked on a phone this column is a short band, and a
          white disc behind white copy simply erases it. */}
      <div className="hidden lg:block absolute bottom-[-130px] left-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none" />
    </div>

    {/* --- WHITE CARD COLUMN --- */}
    <div className="w-full bg-white min-h-screen lg:h-full lg:overflow-y-auto flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-12 relative shrink-0 z-10 shadow-2xl lg:w-[65%] lg:order-2 lg:rounded-l-[48px] lg:rounded-r-none">

      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-28 h-28 bg-[#6D43EC] rounded-br-full pointer-events-none" />
      <div className="absolute top-10 left-36 w-3 h-3 bg-[#6D43EC] rounded-full opacity-60 pointer-events-none" />
      <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-[#ECE9FE] rounded-full pointer-events-none" />
      <div className="absolute top-16 right-10 w-14 h-14 bg-[#ECE9FE] rounded-full pointer-events-none opacity-80" />

      {/* Balances the card vertically against the decorative corner above */}
      <div className="h-[40px] z-10 shrink-0" />

      <div className="my-auto w-full z-10 py-2 shrink-0">
        <div className="w-full max-w-[420px] mx-auto text-center space-y-6">
          {children}
        </div>
      </div>

      <div className="mt-4 z-10 text-center space-y-3 shrink-0">
        {footer}
      </div>

    </div>

  </div>
);

export default AuthLayout;
