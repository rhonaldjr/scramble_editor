import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapRangeSegments,
  rangeHasMark,
  setMarkOnRange,
  toggleMark,
  setLinkOnRange,
} from '../public/editor/segments.js';

test('setMarkOnRange marks only the selected slice', () => {
  const segs = [{ text: 'Hello world', marks: [] }];
  assert.deepEqual(setMarkOnRange(segs, 0, 5, 'bold', true), [
    { text: 'Hello', marks: ['bold'] },
    { text: ' world', marks: [] },
  ]);
});

test('rangeHasMark is true only when the whole range carries the mark', () => {
  const segs = [
    { text: 'Hello', marks: ['bold'] },
    { text: ' world', marks: [] },
  ];
  assert.ok(rangeHasMark(segs, 0, 5, 'bold'));
  assert.ok(!rangeHasMark(segs, 0, 11, 'bold'));
  assert.ok(!rangeHasMark(segs, 5, 5, 'bold')); // empty range
});

test('toggleMark adds when mixed, removes when uniform', () => {
  const mixed = [
    { text: 'ab', marks: ['bold'] },
    { text: 'cd', marks: [] },
  ];
  assert.deepEqual(toggleMark(mixed, 0, 4, 'bold'), [{ text: 'abcd', marks: ['bold'] }]);

  const uniform = [{ text: 'abcd', marks: ['bold'] }];
  assert.deepEqual(toggleMark(uniform, 0, 4, 'bold'), [{ text: 'abcd', marks: [] }]);
});

test('toggleMark leaves surrounding formatting intact', () => {
  const segs = [{ text: 'abcdef', marks: ['italic'] }];
  assert.deepEqual(toggleMark(segs, 2, 4, 'bold'), [
    { text: 'ab', marks: ['italic'] },
    { text: 'cd', marks: ['italic', 'bold'] },
    { text: 'ef', marks: ['italic'] },
  ]);
});

test('setLinkOnRange applies then clears a link + mark', () => {
  const segs = [{ text: 'go home', marks: [] }];
  const linked = setLinkOnRange(segs, 0, 2, 'http://a.com');
  assert.deepEqual(linked, [
    { text: 'go', marks: ['link'], link: 'http://a.com' },
    { text: ' home', marks: [] },
  ]);
  const cleared = setLinkOnRange(linked, 0, 2, '');
  assert.deepEqual(cleared, [{ text: 'go home', marks: [] }]);
});

test('mapRangeSegments only transforms segments inside the range', () => {
  const segs = [{ text: 'abcdef', marks: [] }];
  const out = mapRangeSegments(segs, 2, 4, (seg) => ({ ...seg, text: seg.text.toUpperCase() }));
  assert.deepEqual(out, [
    { text: 'ab', marks: [] },
    { text: 'CD', marks: [] },
    { text: 'ef', marks: [] },
  ]);
});
