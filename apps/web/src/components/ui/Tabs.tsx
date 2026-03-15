import React, { useState, useRef, useEffect, useCallback } from 'react';

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
  const tabListRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const handleChange = (tabId: string) => {
    if (onChange) onChange(tabId);
    else setInternalTab(tabId);
  };

  const updateIndicator = useCallback(() => {
    if (!tabListRef.current) return;
    const activeBtn = tabListRef.current.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (activeBtn) {
      setIndicator({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth });
    }
  }, []);

  useEffect(() => {
    updateIndicator();
  }, [active, updateIndicator]);

  return (
    <div className={className}>
      <div ref={tabListRef} className="relative flex border-b border-border mb-4" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => handleChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-body font-medium
              transition-colors duration-200 ease-expo -mb-px
              ${
                active === tab.id
                  ? 'text-content-primary'
                  : 'text-content-tertiary hover:text-content-secondary'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        {/* Sliding indicator */}
        <div
          className="absolute bottom-0 h-0.5 bg-brand rounded-full transition-all duration-300 ease-expo"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
      <div role="tabpanel">{children(active)}</div>
    </div>
  );
}
