// Block creation and light in-place conversion, shared by editing, the slash
// menu, and markdown shortcuts. Full Turn Into (group-aware mapping) is Phase 4.

import { getBlock } from './registry.js';
import { normalizeSegments } from './segments.js';

let idCounter = 0;

/** Unique-enough block id for a local, single-user session. */
export function newId() {
  idCounter += 1;
  return `blk-${Date.now().toString(36)}-${idCounter}`;
}

/** Build a fresh block of `type` carrying `segments`. */
export function createBlock(type, segments = [{ text: '', marks: [] }]) {
  const def = getBlock(type);
  const data = def ? def.create({ segments }) : { segments: normalizeSegments(segments) };
  return { id: newId(), type, data, props: {}, children: [] };
}

/**
 * Change a block's type in place, re-deriving its data from the target block's
 * create() while carrying over the existing segments. Mutates `block`.
 */
export function convertBlock(block, type) {
  const def = getBlock(type);
  if (!def) return block;
  const segments = (block.data && block.data.segments) || [{ text: '', marks: [] }];
  block.type = type;
  block.data = def.create({ segments });
  return block;
}

/**
 * Deep-clone a block subtree, assigning fresh ids from `makeId`. Pure (the id
 * factory is injected) so duplication is testable. data/props are deep-copied.
 */
export function cloneWithIds(block, makeId) {
  return {
    id: makeId(),
    type: block.type,
    data: JSON.parse(JSON.stringify(block.data || {})),
    props: JSON.parse(JSON.stringify(block.props || {})),
    children: (block.children || []).map((child) => cloneWithIds(child, makeId)),
  };
}

/** Duplicate a block subtree with new ids (uses the session id generator). */
export function duplicateBlock(block) {
  return cloneWithIds(block, newId);
}
