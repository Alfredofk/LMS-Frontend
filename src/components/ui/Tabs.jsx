import React from 'react';

/**
 * Reusable and accessible Tabs component.
 * Follows WAI-ARIA practices for tab lists.
 */
export const Tabs = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  const handleKeyDown = (e, index) => {
    let newIndex = index;
    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabs.length) % tabs.length;
    }

    if (newIndex !== index) {
      e.preventDefault();
      onChange(tabs[newIndex].id);
      // Find element and focus it
      const tabElement = document.getElementById(`tab-trigger-${tabs[newIndex].id}`);
      if (tabElement) tabElement.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Role selector"
      className={`flex p-1 bg-slate-100 rounded-xl gap-1 w-full ${className}`}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-trigger-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              flex-1 text-center py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600
              ${isActive 
                ? 'bg-white text-violet-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
              }
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
