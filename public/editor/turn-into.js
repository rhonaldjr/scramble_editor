// Turn Into: convert a block to another type in the same turnIntoGroup, mapping
// segments and children across types. Pure — no DOM — so the mapping is
// unit-testable. The handle menu drives it; slash/shortcuts use block-ops.

import { getBlock, listBlocks } from './registry.js';

/** Can `fromType` convert to `toType`? Both must share a non-null group. */
export function canTurnInto(fromType, toType) {
  const from = getBlock(fromType);
  const to = getBlock(toType);
  return Boolean(from && to && from.turnIntoGroup && from.turnIntoGroup === to.turnIntoGroup);
}

/** Registered block defs a block of `fromType` can convert into (incl. itself). */
export function turnIntoTargets(fromType) {
  const from = getBlock(fromType);
  if (!from || !from.turnIntoGroup) return [];
  return listBlocks().filter((def) => def.turnIntoGroup === from.turnIntoGroup);
}

/**
 * Convert `block` to `toType` in place. Segments carry over; children are kept
 * (a heading's toggles survive; a checklist gains/loses its `checked` flag via
 * the target's create()). Returns true when the conversion happened.
 */
export function turnInto(block, toType) {
  if (block.type === toType) return false;
  if (!canTurnInto(block.type, toType)) return false;
  const def = getBlock(toType);
  const segments = (block.data && block.data.segments) || [{ text: '', marks: [] }];
  block.type = toType;
  block.data = def.create({ segments });
  return true;
}
