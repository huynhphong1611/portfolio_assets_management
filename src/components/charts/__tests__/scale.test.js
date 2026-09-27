import { describe, it, expect } from 'vitest';
import { niceTicks, compactVND, compactPct, dateAxisLabel } from '../scale';

describe('chart scale helpers', () => {
  it('produces round tick values that cover the data', () => {
    const { min, max, ticks } = niceTicks(-36.7, 173.3, 4);
    expect(min).toBeLessThanOrEqual(-36.7);
    expect(max).toBeGreaterThanOrEqual(173.3);
    expect(ticks).toEqual([-50, 0, 50, 100, 150, 200]);
  });
  it('handles flat and VND-sized ranges', () => {
    expect(niceTicks(5, 5).ticks.length).toBeGreaterThan(1);
    const t = niceTicks(300e6, 951e6, 4);
    expect(t.ticks[0]).toBe(200e6);
    expect(t.ticks[t.ticks.length - 1]).toBe(1e9);
  });
  it('formats compact labels', () => {
    expect(compactVND(1.5e9)).toBe('1.5 tỷ');
    expect(compactVND(20e6)).toBe('20 tr');
    expect(compactVND(-30e6)).toBe('−30 tr');
    expect(compactVND(8.45e6, 5e4, 8.5e6)).toBe('8.45 tr');
    expect(compactVND(8.4e6, 5e4, 8.5e6)).toBe('8.4 tr');
    expect(compactVND(7.5e6, 2.5e6, 1e7)).toBe('7.5 tr');
    expect(compactVND(2e8, 2e8, 1e9)).toBe('0.2 tỷ');
    expect(compactPct(50)).toBe('50%');
    expect(compactPct(12.5)).toBe('12.5%');
    expect(dateAxisLabel('2026-09-27', false)).toBe('27/09');
    expect(dateAxisLabel('2026-09-27', true)).toBe('09/26');
  });
});
