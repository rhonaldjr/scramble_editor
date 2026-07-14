// Color tokens for text (`color`), highlight (`background`) and badge (`badge`).
// Stored as tokens on segments/blocks, resolved to CSS at render time.
// `default` = inherit / none. Palettes are deliberately vibrant (ClickUp-style).

// Foreground text colors (vibrant).
export const TEXT_COLORS = {
  default: null,
  red: '#e03e3e',
  orange: '#d9730d',
  brown: '#8b5e3c',
  yellow: '#cb9a04',
  green: '#0f9d58',
  blue: '#2266dd',
  purple: '#7a3ff0',
  pink: '#d6218e',
  gray: '#787774',
  black: '#0f0f0f',
};

// Highlight / background wash behind text (soft tints).
export const BG_COLORS = {
  default: null,
  red: '#ffdcd6',
  orange: '#ffe2c2',
  yellow: '#fff2b8',
  green: '#c8f0d4',
  blue: '#d0e4ff',
  purple: '#e6dcff',
  pink: '#ffd6ec',
  gray: '#e4e6ea',
  brown: '#e9e0d8',
};

// Badges — a solid pill with contrasting text. Each token maps to { bg, fg }.
// Two variants: vibrant (solid) and soft (tinted).
export const BADGE_COLORS = {
  red: { bg: '#c92a2a', fg: '#ffffff' },
  orange: { bg: '#e8590c', fg: '#ffffff' },
  yellow: { bg: '#f2b705', fg: '#3d2f00' },
  green: { bg: '#2b8a3e', fg: '#ffffff' },
  blue: { bg: '#1565d8', fg: '#ffffff' },
  purple: { bg: '#5f3dc4', fg: '#ffffff' },
  pink: { bg: '#c2255c', fg: '#ffffff' },
  gray: { bg: '#868e96', fg: '#ffffff' },
  'red-soft': { bg: '#ffc9c0', fg: '#a02a1a' },
  'orange-soft': { bg: '#ffd8a8', fg: '#a15c00' },
  'yellow-soft': { bg: '#ffec99', fg: '#8a6d00' },
  'green-soft': { bg: '#b2f2bb', fg: '#2b8a3e' },
  'blue-soft': { bg: '#a5d8ff', fg: '#0b4a9c' },
  'purple-soft': { bg: '#d0bfff', fg: '#5f3dc4' },
  'pink-soft': { bg: '#fcc2d7', fg: '#a61e4d' },
  'gray-soft': { bg: '#dee2e6', fg: '#495057' },
};

// Ordered token lists for the inline color picker.
export const TEXT_TOKENS = ['red', 'orange', 'brown', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray', 'black'];
export const HIGHLIGHT_TOKENS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'];
export const BADGE_TOKENS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'];
export const BADGE_SOFT_TOKENS = BADGE_TOKENS.map((t) => `${t}-soft`);

// Shared block-level palette (handle menu text/bg color) — tokens present in
// both TEXT_COLORS and BG_COLORS. Kept stable so existing docs still resolve.
export const COLOR_TOKENS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
