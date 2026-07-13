import test from 'node:test';
import assert from 'node:assert/strict';

import { moveUp, moveDown, flattenBlocks, findBlock } from '../public/editor/model.js';
import { cloneWithIds } from '../public/editor/block-ops.js';

function blk(id, children = []) {
  return { id, type: 'paragraph', data: { segments: [{ text: id, marks: [] }] }, props: {}, children };
}

test('moveUp / moveDown swap with an adjacent sibling; no-op at edges', () => {
  const blocks = [blk('a'), blk('b'), blk('c')];
  assert.ok(moveDown(blocks, 'a'));
  assert.deepEqual(blocks.map((b) => b.id), ['b', 'a', 'c']);
  assert.ok(moveUp(blocks, 'a'));
  assert.deepEqual(blocks.map((b) => b.id), ['a', 'b', 'c']);
  assert.equal(moveUp(blocks, 'a'), false); // already first
  assert.equal(moveDown(blocks, 'c'), false); // already last
});

test('moveUp works among nested siblings only', () => {
  const blocks = [blk('a', [blk('a1'), blk('a2')])];
  assert.ok(moveUp(blocks, 'a2'));
  assert.deepEqual(findBlock(blocks, 'a').block.children.map((b) => b.id), ['a2', 'a1']);
});

test('cloneWithIds deep-copies structure and assigns fresh ids', () => {
  let n = 0;
  const makeId = () => `new-${(n += 1)}`;
  const original = blk('root', [blk('child', [blk('grand')])]);
  const copy = cloneWithIds(original, makeId);

  // ids are all fresh
  assert.deepEqual(flattenBlocks([copy]).map((b) => b.id), ['new-1', 'new-2', 'new-3']);
  // structure + data preserved
  assert.equal(copy.children[0].children[0].data.segments[0].text, 'grand');
  // deep copy: mutating the clone does not touch the original
  copy.children[0].data.segments[0].text = 'changed';
  assert.equal(original.children[0].data.segments[0].text, 'child');
});
