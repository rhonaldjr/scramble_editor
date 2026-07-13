import test from 'node:test';
import assert from 'node:assert/strict';

import {
  registerBlock,
  getBlock,
  hasBlock,
  listBlocks,
  clearRegistry,
} from '../public/editor/registry.js';

function stub(type) {
  return { type, label: type, create: () => ({}) };
}

test('registerBlock stores and getBlock/hasBlock retrieve', () => {
  clearRegistry();
  const def = stub('paragraph');
  assert.equal(registerBlock(def), def);
  assert.equal(getBlock('paragraph'), def);
  assert.equal(hasBlock('paragraph'), true);
  assert.equal(getBlock('missing'), null);
  assert.equal(hasBlock('missing'), false);
});

test('registerBlock rejects a missing or empty type', () => {
  clearRegistry();
  assert.throws(() => registerBlock({ create: () => ({}) }), /type/);
  assert.throws(() => registerBlock({ type: '', create: () => ({}) }), /type/);
});

test('registerBlock requires a create() function', () => {
  clearRegistry();
  assert.throws(() => registerBlock({ type: 'x' }), /create/);
});

test('registerBlock rejects duplicates', () => {
  clearRegistry();
  registerBlock(stub('para'));
  assert.throws(() => registerBlock(stub('para')), /already registered/);
});

test('listBlocks returns definitions in insertion order', () => {
  clearRegistry();
  registerBlock(stub('a'));
  registerBlock(stub('b'));
  registerBlock(stub('c'));
  assert.deepEqual(listBlocks().map((d) => d.type), ['a', 'b', 'c']);
});

test('clearRegistry empties the registry', () => {
  clearRegistry();
  registerBlock(stub('a'));
  clearRegistry();
  assert.deepEqual(listBlocks(), []);
});
