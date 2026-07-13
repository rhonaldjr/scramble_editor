import test from 'node:test';
import assert from 'node:assert/strict';

import { clearRegistry, listBlocks, getBlock } from '../public/editor/registry.js';
import { registerBuiltins, builtinBlocks } from '../public/editor/blocks/index.js';

test('registerBuiltins registers every built-in exactly once (idempotent)', () => {
  clearRegistry();
  registerBuiltins();
  registerBuiltins(); // second call must not throw or duplicate
  assert.equal(listBlocks().length, builtinBlocks.length);
});

test('Phase 1 block types are all present', () => {
  clearRegistry();
  registerBuiltins();
  const types = listBlocks().map((d) => d.type).sort();
  assert.deepEqual(types, [
    'bulleted-list',
    'checklist',
    'divider',
    'heading-1',
    'heading-2',
    'heading-3',
    'numbered-list',
    'paragraph',
    'quote',
  ]);
});

test('text blocks share the "text" Turn Into group; divider is null', () => {
  clearRegistry();
  registerBuiltins();
  for (const type of ['paragraph', 'heading-1', 'quote', 'bulleted-list', 'checklist']) {
    assert.equal(getBlock(type).turnIntoGroup, 'text', type);
  }
  assert.equal(getBlock('divider').turnIntoGroup, null);
});

test('paragraph.create seeds a single empty segment', () => {
  clearRegistry();
  registerBuiltins();
  assert.deepEqual(getBlock('paragraph').create(), { segments: [{ text: '', marks: [] }] });
});

test('create normalizes provided segments', () => {
  clearRegistry();
  registerBuiltins();
  const data = getBlock('heading-1').create({
    segments: [
      { text: 'a', marks: [] },
      { text: 'b', marks: [] },
    ],
  });
  assert.deepEqual(data.segments, [{ text: 'ab', marks: [] }]);
});

test('checklist tracks a checked flag; other lists do not', () => {
  clearRegistry();
  registerBuiltins();
  assert.equal(getBlock('checklist').create().checked, false);
  assert.equal(getBlock('checklist').create({ checked: true }).checked, true);
  assert.equal('checked' in getBlock('bulleted-list').create(), false);
});

test('headings and quote continue as paragraphs; lists continue as themselves', () => {
  clearRegistry();
  registerBuiltins();
  assert.equal(getBlock('heading-1').continuationType, 'paragraph');
  assert.equal(getBlock('quote').continuationType, 'paragraph');
  assert.equal(getBlock('bulleted-list').continuationType, 'bulleted-list');
  assert.equal(getBlock('paragraph').continuationType, 'paragraph');
});
