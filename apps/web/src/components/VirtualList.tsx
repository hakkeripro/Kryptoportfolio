import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  overscan?: number;
  height: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string;
};

export function VirtualList<T>(props: VirtualListProps<T>) {
  const { items, itemHeight, height, overscan = 6, className, renderItem, getKey } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll as any);
  }, []);

  const totalHeight = items.length * itemHeight;

  const range = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + height) / itemHeight) + overscan);
    return { start, end };
  }, [scrollTop, itemHeight, overscan, height, items.length]);

  const visible = items.slice(range.start, range.end);

  return (
    <div ref={ref} style={{ height }} className={className}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visible.map((item, i) => {
          const index = range.start + i;
          const top = index * itemHeight;
          const key = getKey ? getKey(item, index) : String(index);
          return (
            <div key={key} style={{ position: 'absolute', top, left: 0, right: 0, height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
