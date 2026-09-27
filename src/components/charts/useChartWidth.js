import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Measure the rendered width of a chart container so the SVG viewBox matches
 * real pixels (axis text keeps its size on phones instead of being scaled down).
 * Returns [callbackRef, width].
 */
export function useChartWidth(fallback = 800, min = 280) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef(null);

  const ref = useCallback((el) => {
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) {
        const next = Math.max(min, w);
        setWidth(prev => (Math.abs(prev - next) >= 1 ? next : prev));
      }
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(measure);
      observer.current.observe(el);
    }
  }, [min]);

  useEffect(() => () => {
    if (observer.current) observer.current.disconnect();
  }, []);

  return [ref, width];
}
