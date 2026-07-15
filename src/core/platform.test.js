import { test, expect } from 'vitest';
import { clampRefresh, REFRESH_OPTIONS, REFRESH_MIN, REFRESH_MAX } from './platform.js';

test('clampRefresh normalizes to none or a bounded interval (5s..1h)', () => {
  expect(clampRefresh('none')).toBe('none');
  expect(clampRefresh(null)).toBe('none');
  expect(clampRefresh('')).toBe('none');
  expect(clampRefresh(0)).toBe('none');
  expect(clampRefresh(-10)).toBe('none');
  expect(clampRefresh('nonsense')).toBe('none');
  expect(clampRefresh(1)).toBe(REFRESH_MIN); // below min → clamped up to 5
  expect(clampRefresh(5)).toBe(5);
  expect(clampRefresh(90)).toBe(90);
  expect(clampRefresh(99999)).toBe(REFRESH_MAX); // above max → clamped to 3600
  expect(clampRefresh('300')).toBe(300); // string number accepted
});

test('REFRESH_OPTIONS spans none + 5s..1h in range', () => {
  const values = REFRESH_OPTIONS.map((o) => o.value);
  expect(values[0]).toBe('none');
  const nums = values.filter((v) => typeof v === 'number');
  expect(Math.min(...nums)).toBe(REFRESH_MIN);
  expect(Math.max(...nums)).toBe(REFRESH_MAX);
});
