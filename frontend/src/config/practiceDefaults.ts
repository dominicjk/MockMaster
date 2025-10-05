// Central configuration for Practice page defaults and year bounds.
// Adjust PRACTICE_YEAR_FIRST / PRACTICE_YEAR_LAST when new exam years are added.

export const PRACTICE_YEAR_FIRST = 2024; // Most recent / starting year (yearFrom)
export const PRACTICE_YEAR_LAST = 2012;  // Oldest / ending year (yearTo)

export const PRACTICE_RESET_DEFAULTS = {
  topics: 'all',
  examOnly: false,
  longOnly: false,
  shortOnly: false,
  customOnly: false,
};

/**
 * Build the full Reset Filters URL including query parameters.
 * origin: by default uses window.location.origin at runtime; can be overridden for SSR/test.
 */
export function buildPracticeResetUrl(origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}/maths/practice/all?topics=${PRACTICE_RESET_DEFAULTS.topics}` +
    `&examOnly=${PRACTICE_RESET_DEFAULTS.examOnly}` +
    `&longOnly=${PRACTICE_RESET_DEFAULTS.longOnly}` +
    `&shortOnly=${PRACTICE_RESET_DEFAULTS.shortOnly}` +
    `&yearFrom=${PRACTICE_YEAR_FIRST}` +
    `&yearTo=${PRACTICE_YEAR_LAST}` +
    `&customOnly=${PRACTICE_RESET_DEFAULTS.customOnly}`;
}
