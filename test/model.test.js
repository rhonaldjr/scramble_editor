import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findBlock,
  flattenBlocks,
  previousBlock,
  nextBlock,
  insertAfter,
  removeBlock,
  moveBlock,
  indentBlock,
  outdentBlock,
  mergeInto,
} from '../public/editor/model.js';

// Minimal block builder: id, optional text, optional children.
function blk(id, text = '', children = []) {
  return { id, type: 'paragraph', data: { segments: [{ text, marks: [] }] }, props: {}, children };
}

// a
// b
//   b1
//   b2
// c
function sample() {
  return [blk('a', 'A'), blk('b', 'B', [blk('b1', 'B1'), blk('b2', 'B2')]), blk('c', 'C')];
}

test('findBlock locates nested blocks with siblings/index/parent', () => {
  const blocks = sample();
  const loc = findBlock(blocks, 'b1');
  assert.equal(loc.block.id, 'b1');
  assert.equal(loc.index, 0);
  assert.equal(loc.parent.id, 'b');
  assert.equal(findBlock(blocks, 'nope'), null);
});

test('flattenBlocks yields visual order', () => {
  assert.deepEqual(flattenBlocks(sample()).map((b) => b.id), ['a', 'b', 'b1', 'b2', 'c']);
});

test('previousBlock / nextBlock walk visual order across nesting', () => {
  const blocks = sample();
  assert.equal(previousBlock(blocks, 'b1').id, 'b');
  assert.equal(nextBlock(blocks, 'b2').id, 'c');
  assert.equal(previousBlock(blocks, 'a'), null);
  assert.equal(nextBlock(blocks, 'c'), null);
});

test('insertAfter places a sibling after the target', () => {
  const blocks = sample();
  insertAfter(blocks, 'a', blk('x', 'X'));
  assert.deepEqual(blocks.map((b) => b.id), ['a', 'x', 'b', 'c']);
});

test('removeBlock detaches and returns the block', () => {
  const blocks = sample();
  const removed = removeBlock(blocks, 'b1');
  assert.equal(removed.id, 'b1');
  assert.deepEqual(flattenBlocks(blocks).map((b) => b.id), ['a', 'b', 'b2', 'c']);
  assert.equal(removeBlock(blocks, 'ghost'), null);
});

test('moveBlock reorders before/after a target', () => {
  const blocks = sample();
  assert.ok(moveBlock(blocks, 'c', 'a', 'before'));
  assert.deepEqual(blocks.map((b) => b.id), ['c', 'a', 'b']);
});

test('moveBlock refuses to move a block into its own subtree', () => {
  const blocks = sample();
  assert.equal(moveBlock(blocks, 'b', 'b1', 'after'), false);
  // tree unchanged
  assert.deepEqual(flattenBlocks(blocks).map((b) => b.id), ['a', 'b', 'b1', 'b2', 'c']);
});

test('indentBlock nests under previous sibling; no-op without one', () => {
  const blocks = sample();
  assert.ok(indentBlock(blocks, 'c')); // c nests under b
  assert.equal(findBlock(blocks, 'c').parent.id, 'b');
  assert.equal(indentBlock(blocks, 'a'), false); // first child, no previous sibling
});

test('outdentBlock lifts a block to sit after its parent; no-op at top level', () => {
  const blocks = sample();
  assert.ok(outdentBlock(blocks, 'b1'));
  assert.deepEqual(blocks.map((b) => b.id), ['a', 'b', 'b1', 'c']);
  assert.equal(findBlock(blocks, 'b1').parent, null);
  assert.equal(outdentBlock(blocks, 'a'), false);
});

test('mergeInto concatenates text, returns the join offset, and adopts children', () => {
  const prev = blk('p', 'foo');
  const cur = blk('q', 'bar', [blk('q1', 'child')]);
  const offset = mergeInto(prev, cur);
  assert.equal(offset, 3);
  assert.equal(prev.data.segments.map((s) => s.text).join(''), 'foobar');
  assert.deepEqual(prev.children.map((b) => b.id), ['q1']);
});
