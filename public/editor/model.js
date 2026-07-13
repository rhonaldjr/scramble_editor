// Document model: pure operations over the block tree. No DOM, no ids created
// here — the editing layer supplies new blocks. Every op returns enough info
// for the caller to re-render and restore the caret. Fully unit-testable.

import { concatSegments, segmentsLength } from './segments.js';

/**
 * Locate a block anywhere in the tree.
 * @returns {{block:object, siblings:object[], index:number, parent:object|null}|null}
 */
export function findBlock(blocks, id, parent = null) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.id === id) return { block, siblings: blocks, index: i, parent };
    const found = findBlock(block.children || [], id, block);
    if (found) return found;
  }
  return null;
}

/** Depth-first list of blocks in visual (document) order. */
export function flattenBlocks(blocks, out = []) {
  for (const block of blocks) {
    out.push(block);
    if (block.children && block.children.length) flattenBlocks(block.children, out);
  }
  return out;
}

/** The block immediately before `id` in visual order, or null. */
export function previousBlock(blocks, id) {
  const flat = flattenBlocks(blocks);
  const idx = flat.findIndex((b) => b.id === id);
  return idx > 0 ? flat[idx - 1] : null;
}

/** The block immediately after `id` in visual order, or null. */
export function nextBlock(blocks, id) {
  const flat = flattenBlocks(blocks);
  const idx = flat.findIndex((b) => b.id === id);
  return idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
}

/** Insert `newBlock` as the sibling right after `id`. */
export function insertAfter(blocks, id, newBlock) {
  const loc = findBlock(blocks, id);
  if (!loc) return false;
  loc.siblings.splice(loc.index + 1, 0, newBlock);
  return true;
}

/** Remove and return the block with `id`, or null if absent. */
export function removeBlock(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc) return null;
  const [removed] = loc.siblings.splice(loc.index, 1);
  return removed;
}

/** True when `id` appears anywhere in `block`'s subtree. */
function containsBlock(block, id) {
  for (const child of block.children || []) {
    if (child.id === id || containsBlock(child, id)) return true;
  }
  return false;
}

/**
 * Move `id` to just before/after `targetId`. Refuses to move a block into its
 * own subtree (which would detach the tree). Returns true on success.
 * @param {'before'|'after'} position
 */
export function moveBlock(blocks, id, targetId, position = 'before') {
  if (id === targetId) return false;
  const src = findBlock(blocks, id);
  if (!src) return false;
  if (containsBlock(src.block, targetId)) return false;
  const block = removeBlock(blocks, id);
  const dst = findBlock(blocks, targetId);
  if (!dst) return false;
  const at = position === 'after' ? dst.index + 1 : dst.index;
  dst.siblings.splice(at, 0, block);
  return true;
}

/** Swap a block with its previous sibling. No-op when it is already first. */
export function moveUp(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || loc.index === 0) return false;
  const arr = loc.siblings;
  [arr[loc.index - 1], arr[loc.index]] = [arr[loc.index], arr[loc.index - 1]];
  return true;
}

/** Swap a block with its next sibling. No-op when it is already last. */
export function moveDown(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || loc.index === loc.siblings.length - 1) return false;
  const arr = loc.siblings;
  [arr[loc.index + 1], arr[loc.index]] = [arr[loc.index], arr[loc.index + 1]];
  return true;
}

/** Nest a block under its previous sibling (Tab). No-op with no previous sibling. */
export function indentBlock(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || loc.index === 0) return false;
  const prevSibling = loc.siblings[loc.index - 1];
  loc.siblings.splice(loc.index, 1);
  prevSibling.children = prevSibling.children || [];
  prevSibling.children.push(loc.block);
  return true;
}

/** Un-nest a block to sit right after its parent (Shift+Tab). No-op at top level. */
export function outdentBlock(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || !loc.parent) return false;
  const parentLoc = findBlock(blocks, loc.parent.id);
  if (!parentLoc) return false;
  loc.siblings.splice(loc.index, 1);
  parentLoc.siblings.splice(parentLoc.index + 1, 0, loc.block);
  return true;
}

/**
 * Merge `block`'s text into `prev` (Backspace at start). `prev`'s children are
 * kept; `block`'s children are appended to `prev`. Mutates `prev`; the caller
 * removes `block`. Returns the caret offset (the join point) in `prev`.
 */
export function mergeInto(prev, block) {
  const offset = segmentsLength(prev.data.segments);
  prev.data.segments = concatSegments(prev.data.segments, block.data.segments);
  if (block.children && block.children.length) {
    prev.children = [...(prev.children || []), ...block.children];
  }
  return offset;
}
