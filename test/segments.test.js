import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSegment,
  marksEqual,
  normalizeSegments,
  segmentsText,
  segmentsLength,
  isEmptySegments,
  sliceSegments,
  splitSegmentsAt,
  concatSegments,
  segmentsToHTML,
} from '../public/editor/segments.js';

test('createSegment copies the marks array', () => {
  const marks = ['bold'];
  const seg = createSegment('hi', marks);
  seg.marks.push('italic');
  assert.deepEqual(marks, ['bold']);
});

test('marksEqual ignores order and detects difference', () => {
  assert.ok(marksEqual(['bold', 'italic'], ['italic', 'bold']));
  assert.ok(!marksEqual(['bold'], ['bold', 'italic']));
  assert.ok(!marksEqual(['bold'], ['italic']));
});

test('normalizeSegments merges adjacent same-mark segments and drops empties', () => {
  const out = normalizeSegments([
    { text: 'Hello ', marks: [] },
    { text: '', marks: [] },
    { text: 'brave ', marks: [] },
    { text: 'world', marks: ['bold'] },
  ]);
  assert.deepEqual(out, [
    { text: 'Hello brave ', marks: [] },
    { text: 'world', marks: ['bold'] },
  ]);
});

test('normalizeSegments keeps mentions separate and never returns empty list', () => {
  const withMention = normalizeSegments([
    { text: 'hi ', marks: [] },
    { text: '@Jane', marks: [], mention: { contactId: 'c1' } },
    { text: '!', marks: [] },
  ]);
  assert.equal(withMention.length, 3);
  assert.deepEqual(normalizeSegments([]), [{ text: '', marks: [] }]);
});

test('segmentsText / segmentsLength / isEmptySegments', () => {
  const segs = [
    { text: 'ab', marks: [] },
    { text: 'cde', marks: ['bold'] },
  ];
  assert.equal(segmentsText(segs), 'abcde');
  assert.equal(segmentsLength(segs), 5);
  assert.ok(!isEmptySegments(segs));
  assert.ok(isEmptySegments([{ text: '', marks: [] }]));
});

test('sliceSegments preserves marks across a boundary', () => {
  const segs = [
    { text: 'Hello ', marks: [] },
    { text: 'world', marks: ['bold'] },
  ];
  assert.deepEqual(sliceSegments(segs, 3, 8), [
    { text: 'lo ', marks: [] },
    { text: 'wo', marks: ['bold'] },
  ]);
});

test('sliceSegments drops a mention when only partially covered', () => {
  const segs = [{ text: '@Jane', marks: [], mention: { contactId: 'c1' } }];
  const partial = sliceSegments(segs, 0, 3);
  assert.equal(partial[0].mention, undefined);
  const full = sliceSegments(segs, 0, 5);
  assert.deepEqual(full[0].mention, { contactId: 'c1' });
});

test('splitSegmentsAt splits into before/after and clamps', () => {
  const segs = [
    { text: 'Hello ', marks: [] },
    { text: 'world', marks: ['bold'] },
  ];
  const [before, after] = splitSegmentsAt(segs, 6);
  assert.deepEqual(before, [{ text: 'Hello ', marks: [] }]);
  assert.deepEqual(after, [{ text: 'world', marks: ['bold'] }]);

  const [b2, a2] = splitSegmentsAt(segs, 999);
  assert.equal(segmentsText(b2), 'Hello world');
  assert.deepEqual(a2, [{ text: '', marks: [] }]);
});

test('concatSegments joins and merges at the seam', () => {
  const out = concatSegments(
    [{ text: 'foo', marks: [] }],
    [{ text: 'bar', marks: [] }],
  );
  assert.deepEqual(out, [{ text: 'foobar', marks: [] }]);
});

test('segmentsToHTML wraps marks and escapes text', () => {
  assert.equal(
    segmentsToHTML([{ text: 'a & b', marks: ['bold'] }]),
    '<strong>a &amp; b</strong>',
  );
  assert.equal(
    segmentsToHTML([{ text: 'x', marks: ['bold', 'italic'] }]),
    '<em><strong>x</strong></em>',
  );
  assert.equal(
    segmentsToHTML([{ text: 'go', marks: [], link: 'http://a.com' }]),
    '<a href="http://a.com">go</a>',
  );
});
