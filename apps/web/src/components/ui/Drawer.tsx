import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Drawer({ open, onClose, title, children, className = '' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t || !touchStart.current) return;
    const dx = t.clientX - touchStart.current.x;
    const dy = Math.abs(t.clientY - touchStart.current.y);
    // Only swipe right; ignore if mostly vertical
    if (!swiping.current && dx > 10 && dx > dy) swiping.current = true;
    if (swiping.current && dx > 0) {
      setSwipeX(dx);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (swiping.current && swipeX > 100) {
      onClose();
    }
    setSwipeX(0);
    touchStart.current = null;
    swiping.current = false;
  }, [swipeX, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        className={`relative z-10 w-full max-w-md h-full bg-surface-overlay border-l border-border
          p-6 shadow-xl overflow-y-auto animate-slide-in-right ${className}`}
        style={
          swipeX > 0 ? { transform: `translateX(${swipeX}px)`, transition: 'none' } : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading-3 text-content-primary">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -m-1 rounded-button text-content-tertiary hover:text-content-primary
                hover:bg-surface-raised transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
