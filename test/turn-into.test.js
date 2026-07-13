import test from 'node:test';
import assert from 'node:assert/strict';

import { clearRegistry } from '../public/editor/registry.js';
import { registerBuiltins } from '../public/editor/blocks/index.js';
import { canTurnInto, turnIntoTargets, turnInto } from '../public/editor/turn-into.js';

function setup() {
  clearRegistry();
  registerBuiltins();
}

function block(type, text = 'hi', children = []) {
  return { id: 'b', type, data: { segments: [{ text, marks: [] }] }, props: {}, children };
}

test('canTurnInto is true within the text group, false across groups', () => {
  setup();
  assert.ok(canTurnInto('paragraph', 'heading-1'));
  assert.ok(canTurnInto('bulleted-list', 'checklist'));
  assert.ok(!canTurnInto('paragraph', 'divider')); // divider group is null
  assert.ok(!canTurnInto('divider', 'paragraph'));
});

test('turnIntoTargets lists all text-group blocks and excludes divider', () => {
  setup();
  const types = turnIntoTargets('paragraph').map((d) => d.type);
  assert.ok(types.includes('heading-1'));
  assert.ok(types.includes('checklist'));
  assert.ok(!types.includes('divider'));
  assert.equal(turnIntoTargets('divider').length, 0);
});

test('turnInto carries segments over and is a no-op for same type / cross group', () => {
  setup();
  const b = block('paragraph', 'keep me');
  assert.ok(turnInto(b, 'heading-2'));
  assert.equal(b.type, 'heading-2');
  assert.deepEqual(b.data.segments, [{ text: 'keep me', marks: [] }]);

  assert.equal(turnInto(b, 'heading-2'), false); // already that type
  assert.equal(turnInto(b, 'divider'), false); // cross group
});

test('turnInto adds/removes checklist checked flag via target create()', () => {
  setup();
  const b = block('paragraph', 'task');
  turnInto(b, 'checklist');
  assert.equal(b.data.checked, false);
  turnInto(b, 'paragraph');
  assert.equal('checked' in b.data, false);
});

test('turnInto preserves children (round trip keeps nested content)', () => {
  setup();
  const b = block('bulleted-list', 'parent', [block('bulleted-list', 'child')]);
  turnInto(b, 'heading-1');
  turnInto(b, 'checklist');
  assert.equal(b.type, 'checklist');
  assert.equal(b.children.length, 1);
  assert.equal(b.children[0].data.segments[0].text, 'child');
});
