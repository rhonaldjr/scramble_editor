// Registers every built-in block. Call registerBuiltins() once at startup.

import { registerBlock, hasBlock } from '../registry.js';
import { paragraph, heading1, heading2, heading3, quote } from './text.js';
import { bulletedList, numberedList, checklist } from './lists.js';
import { divider } from './divider.js';

export const builtinBlocks = [
  paragraph,
  heading1,
  heading2,
  heading3,
  quote,
  bulletedList,
  numberedList,
  checklist,
  divider,
];

/** Register all built-ins. Idempotent: skips types already present. */
export function registerBuiltins() {
  for (const def of builtinBlocks) {
    if (!hasBlock(def.type)) registerBlock(def);
  }
  return builtinBlocks;
}
