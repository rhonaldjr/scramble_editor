import test from 'node:test';
import assert from 'node:assert/strict';

import { segmentsToMarkdown } from '../public/editor/segments.js';
import { toMarkdown, toHTML } from '../server/export.js';

function b(type, text, extra = {}) {
  return { id: type, type, data: { segments: [{ text, marks: [] }], ...extra }, props: {}, children: [] };
}

test('segmentsToMarkdown renders marks and links', () => {
  assert.equal(segmentsToMarkdown([{ text: 'x', marks: ['bold'] }]), '**x**');
  assert.equal(segmentsToMarkdown([{ text: 'x', marks: ['italic'] }]), '*x*');
  assert.equal(segmentsToMarkdown([{ text: 'x', marks: ['code'] }]), '`x`');
  assert.equal(segmentsToMarkdown([{ text: 'x', marks: ['strikethrough'] }]), '~~x~~');
  assert.equal(
    segmentsToMarkdown([{ text: 'go', marks: [], link: 'http://a.com' }]),
    '[go](http://a.com)',
  );
});

test('toMarkdown exports headings, paragraphs, quote, divider', () => {
  const doc = {
    blocks: [b('heading-1', 'Title'), b('paragraph', 'Body text'), b('quote', 'A quote'), b('divider', '')],
  };
  assert.equal(toMarkdown(doc), '# Title\n\nBody text\n\n> A quote\n\n---\n');
});

test('toMarkdown renders lists (tight) and checklists with state', () => {
  const doc = {
    blocks: [
      b('bulleted-list', 'one'),
      b('bulleted-list', 'two'),
      b('checklist', 'done', { checked: true }),
      b('checklist', 'todo', { checked: false }),
    ],
  };
  assert.equal(toMarkdown(doc), '- one\n- two\n- [x] done\n- [ ] todo\n');
});

test('toMarkdown indents nested list children', () => {
  const parent = b('bulleted-list', 'parent');
  parent.children = [b('bulleted-list', 'child')];
  assert.equal(toMarkdown({ blocks: [parent] }), '- parent\n  - child\n');
});

test('toHTML groups consecutive list items and escapes text', () => {
  const doc = {
    blocks: [b('heading-2', 'H & M'), b('bulleted-list', 'a'), b('bulleted-list', 'b')],
  };
  assert.equal(toHTML(doc), '<h2>H &amp; M</h2><ul><li>a</li><li>b</li></ul>');
});

test('toHTML renders a numbered list as <ol> and checklist checkboxes', () => {
  const doc = {
    blocks: [
      b('numbered-list', 'first'),
      b('checklist', 'x', { checked: true }),
    ],
  };
  assert.equal(
    toHTML(doc),
    '<ol><li>first</li></ol><ul class="sc-checklist"><li><input type="checkbox" disabled checked> x</li></ul>',
  );
});
