import React from 'react';

/**
 * Reusable Card component.
 * Provides a clean container with modern borders, background, and shadows.
 */
export const Card = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`
        bg-white rounded-3xl border border-slate-100/80 shadow-2xl shadow-slate-200/50 
        overflow-hidden transition-all duration-300 ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`p-6 md:p-8 pb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`px-6 md:px-8 pb-6 md:pb-8 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`px-6 md:px-8 py-4 bg-slate-50 border-t border-slate-100/60 ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
