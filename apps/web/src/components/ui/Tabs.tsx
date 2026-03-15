import React, { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onChange?: (tabId: string) => void;
  children: (activeTab: string) => React.ReactNode;
  className?: string;
}

export function Tabs({
  tabs,
  activeTab: controlledTab,
  onChange,
  children,
  className = '',
}: TabsProps) {
  const [internalTab, setInternalTab] = useState(tabs[0]?.id ?? '');
  const active = controlledTab ?? internalTab;

  const handleChange = (tabId: string) => {
    if (onChange) onChange(tabId);
    else setInternalTab(tabId);
  };

  return (
    <div className={className}>
      <div className="flex border-b border-border mb-4" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => handleChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-body font-medium border-b-2
              transition-colors -mb-px
              ${
                active === tab.id
                  ? 'border-brand text-content-primary'
                  : 'border-transparent text-content-tertiary hover:text-content-secondary'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children(active)}</div>
    </div>
  );
}
