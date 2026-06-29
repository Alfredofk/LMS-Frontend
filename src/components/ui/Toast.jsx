import React, { useEffect } from 'react';

/**
 * Reusable and accessible Toast Notification banner.
 * Replaces standard browser alerts with a high-fidelity sliding toast.
 */
export const Toast = ({
  message,
  type = 'info', // 'success' | 'error' | 'info'
  duration = 4000,
  onClose,
}) => {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-emerald-100',
    error: 'bg-red-50 border-red-500 text-red-800 shadow-red-100',
    info: 'bg-violet-50 border-violet-500 text-violet-800 shadow-violet-100',
  };

  const icons = {
    success: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-500 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-500 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    info: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-violet-500 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.028M12 7.5h.008v.008H12V7.5z" />
      </svg>
    ),
  };

  return (
    <div
      className="fixed top-5 right-5 z-50 w-full max-w-sm px-4 animate-slide-in pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`
          flex items-center gap-3 p-4 rounded-2xl border-l-4 shadow-lg pointer-events-auto bg-white transition-all duration-300
          ${bgColors[type]}
        `}
      >
        {icons[type]}
        <div className="flex-1 text-sm font-semibold leading-snug">
          {message}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg focus:outline-none"
          aria-label="Dismiss notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;
