// Platform Content block helpers — pure, framework-free (Vitest-covered).
// The block resolves its content through host adapters; these helpers only cover
// the refresh-rate policy.

// Refresh cadence: 'none' (resolve once, on page load) or a fixed interval in
// seconds. Intervals are clamped between 5 seconds and 1 hour.
export const REFRESH_MIN = 5;
export const REFRESH_MAX = 3600;

export const REFRESH_OPTIONS = [
  { value: 'none', label: 'On page load' },
  { value: 5, label: 'Every 5 seconds' },
  { value: 10, label: 'Every 10 seconds' },
  { value: 30, label: 'Every 30 seconds' },
  { value: 60, label: 'Every minute' },
  { value: 300, label: 'Every 5 minutes' },
  { value: 900, label: 'Every 15 minutes' },
  { value: 1800, label: 'Every 30 minutes' },
  { value: 3600, label: 'Every hour' },
];

// Normalize a refresh value to 'none' or an integer number of seconds in range.
export function clampRefresh(value) {
  if (value === 'none' || value == null || value === '') return 'none';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'none';
  return Math.min(REFRESH_MAX, Math.max(REFRESH_MIN, Math.round(n)));
}
