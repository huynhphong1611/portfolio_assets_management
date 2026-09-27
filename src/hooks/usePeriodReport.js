import { useMemo } from 'react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../contexts/ReportingPeriodContext.jsx';
import { computePeriodReport } from '../utils/performanceEngine.js';

/**
 * Performance report for the currently selected reporting period.
 * @param {'portfolioValue'|'netWorth'|'totalAssets'} valueKey
 */
export function usePeriodReport(valueKey = 'portfolioValue') {
  const { snapshots, transactions } = usePortfolioData();
  const { range } = useReportingPeriod();
  return useMemo(
    () => computePeriodReport({ snapshots, transactions, start: range.start, end: range.end, valueKey }),
    [snapshots, transactions, range.start, range.end, valueKey]
  );
}
