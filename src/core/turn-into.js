// Turn Into: convert a block to another type in the same registry `group`,
// carrying segments and children over. Pure — framework-free, testable.
import { getBlock, listBlocks } from './registry.js';

/** Can `fromType` convert to `toType`? Both must share a non-null group. */
export function canTurnInto(fromType, toType) {
  const from = getBlock(fromType);
  const to = getBlock(toType);
  return Boolean(from && to && from.group && from.group === to.group);
}

/** Registered defs a block of `fromType` can convert into (incl. itself). */
export function turnIntoTargets(fromType) {
  const from = getBlock(fromType);
  if (!from || !from.group) return [];
  return listBlocks().filter((def) => def.group === from.group);
}

/**
 * Convert `block` to `toType` in place. Segments carry over; children stay; the
 * target's create() re-derives type-specific data (e.g. checklist `checked`).
 * Returns true when it happened.
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
