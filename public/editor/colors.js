// Color tokens for text and background (props.color / props.background). Stored
// as tokens on the block, resolved to CSS at render time. `default` = inherit.

export const TEXT_COLORS = {
  default: null,
  gray: '#787774',
  brown: '#976d57',
  orange: '#cc772f',
  yellow: '#c29343',
  green: '#4f9768',
  blue: '#487ca5',
  purple: '#8a67ab',
  pink: '#b8628f',
  red: '#c4554d',
};

export const BG_COLORS = {
  default: null,
  gray: '#ebeced',
  brown: '#e9e5e3',
  orange: '#faebdd',
  yellow: '#fbf3db',
  green: '#ddedea',
  blue: '#ddebf1',
  purple: '#eae4f2',
  pink: '#f4dfeb',
  red: '#fbe4e4',
};

export const COLOR_TOKENS = Object.keys(TEXT_COLORS);
