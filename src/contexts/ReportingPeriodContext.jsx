import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { usePortfolioData } from './PortfolioDataContext.jsx';
import { resolvePeriod, periodLabel, DEFAULT_PERIOD } from '../utils/reportingPeriod.js';

const STORAGE_KEY = 'pp.reportingPeriod';
const ReportingPeriodContext = createContext(null);

export function useReportingPeriod() {
  const ctx = useContext(ReportingPeriodContext);
  if (!ctx) throw new Error('useReportingPeriod must be used inside <ReportingPeriodProvider>');
  return ctx;
}

function loadSelection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.preset) return { ...DEFAULT_PERIOD, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_PERIOD;
}

/** Global reporting period (the drop-down in the toolbar). */
export function ReportingPeriodProvider({ children }) {
  const { firstDate, today } = usePortfolioData();
  const [selection, setSelection] = useState(loadSelection);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selection)); } catch { /* ignore */ }
  }, [selection]);

  const range = useMemo(() => resolvePeriod(selection, { firstDate, today }), [selection, firstDate, today]);

  const value = useMemo(() => ({
    selection,
    setSelection,
    setPreset: (preset) => setSelection(s => ({ ...s, preset })),
    setCustom: (customStart, customEnd) => setSelection({ preset: 'CUSTOM', customStart, customEnd }),
    range,
    label: periodLabel(selection),
  }), [selection, range]);

  return (
    <ReportingPeriodContext.Provider value={value}>
      {children}
    </ReportingPeriodContext.Provider>
  );
}
