// Document tree operations. Pure — mutate the passed array (the Vue store holds
// a reactive doc, so these mutations trigger re-render automatically).

import { concatSegments, segmentsLength } from './segments.js';

export function findBlock(blocks, id, parent = null) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.id === id) return { block, siblings: blocks, index: i, parent };
    const found = findBlock(block.children || [], id, block);
    if (found) return found;
  }
  return null;
}

export function flattenBlocks(blocks, out = []) {
  for (const block of blocks) {
    out.push(block);
    if (block.children && block.children.length) flattenBlocks(block.children, out);
  }
  return out;
}

export function previousBlock(blocks, id) {
  const flat = flattenBlocks(blocks);
  const idx = flat.findIndex((b) => b.id === id);
  return idx > 0 ? flat[idx - 1] : null;
}

export function nextBlock(blocks, id) {
  const flat = flattenBlocks(blocks);
  const idx = flat.findIndex((b) => b.id === id);
  return idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
}

export function insertAfter(blocks, id, newBlock) {
  const loc = findBlock(blocks, id);
  if (!loc) return false;
  loc.siblings.splice(loc.index + 1, 0, newBlock);
  return true;
}

export function removeBlock(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc) return null;
  const [removed] = loc.siblings.splice(loc.index, 1);
  return removed;
}

function containsBlock(block, id) {
  for (const child of block.children || []) {
    if (child.id === id || containsBlock(child, id)) return true;
  }
  return false;
}

export function moveBlock(blocks, id, targetId, position = 'before') {
  if (id === targetId) return false;
  const src = findBlock(blocks, id);
  if (!src || containsBlock(src.block, targetId)) return false;
  const block = removeBlock(blocks, id);
  const dst = findBlock(blocks, targetId);
  if (!dst) return false;
  dst.siblings.splice(position === 'after' ? dst.index + 1 : dst.index, 0, block);
  return true;
}

export function moveUp(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || loc.index === 0) return false;
  const a = loc.siblings;
  [a[loc.index - 1], a[loc.index]] = [a[loc.index], a[loc.index - 1]];
  return true;
}

export function moveDown(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || loc.index === loc.siblings.length - 1) return false;
  const a = loc.siblings;
  [a[loc.index + 1], a[loc.index]] = [a[loc.index], a[loc.index + 1]];
  return true;
}

export function indentBlock(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || loc.index === 0) return false;
  const prev = loc.siblings[loc.index - 1];
  loc.siblings.splice(loc.index, 1);
  prev.children = prev.children || [];
  prev.children.push(loc.block);
  return true;
}

export function outdentBlock(blocks, id) {
  const loc = findBlock(blocks, id);
  if (!loc || !loc.parent) return false;
  const parentLoc = findBlock(blocks, loc.parent.id);
  if (!parentLoc) return false;
  loc.siblings.splice(loc.index, 1);
  parentLoc.siblings.splice(parentLoc.index + 1, 0, loc.block);
  return true;
}

export function mergeInto(prev, block) {
  const offset = segmentsLength(prev.data.segments);
  prev.data.segments = concatSegments(prev.data.segments, block.data.segments);
  if (block.children && block.children.length) {
    prev.children = [...(prev.children || []), ...block.children];
  }
  return offset;
}

/** Deep-clone a block subtree with fresh ids (id factory injected → testable). */
export function cloneWithIds(block, makeId) {
  return {
    id: makeId(),
    type: block.type,
    data: JSON.parse(JSON.stringify(block.data || {})),
    props: JSON.parse(JSON.stringify(block.props || {})),
    children: (block.children || []).map((child) => cloneWithIds(child, makeId)),
  };
}
