// Core-logic tests (run with `npm test` → vitest). Framework-free, no DOM.
import { test, expect } from 'vitest';
import {
  splitSegmentsAt, toggleMark, segmentsToMarkdown, sliceSegments, concatSegments,
  normalizeSegments, segmentsToHTML, setLinkOnRange, setSegmentColor,
} from './segments.js';
import { findBlock, indentBlock, mergeInto, cloneWithIds, flattenBlocks } from './model.js';
import { registerBlock, clearRegistry } from './registry.js';
import { toMarkdown, toHTML } from './exporter.js';
import { canTurnInto, turnIntoTargets, turnInto } from './turn-into.js';
import { headingLevel, visibleAfterCollapse } from './collapse.js';
import { youtubeId } from './embed.js';

test('splitSegmentsAt splits preserving marks', () => {
  const [before, after] = splitSegmentsAt(
    [{ text: 'Hello ', marks: [] }, { text: 'world', marks: ['bold'] }],
    6,
  );
  expect(before).toEqual([{ text: 'Hello ', marks: [] }]);
  expect(after).toEqual([{ text: 'world', marks: ['bold'] }]);
});

test('toggleMark applies to the selected slice only', () => {
  expect(toggleMark([{ text: 'abcdef', marks: [] }], 2, 4, 'bold')).toEqual([
    { text: 'ab', marks: [] },
    { text: 'cd', marks: ['bold'] },
    { text: 'ef', marks: [] },
  ]);
});

test('segmentsToMarkdown renders marks', () => {
  expect(segmentsToMarkdown([{ text: 'x', marks: ['bold'] }])).toBe('**x**');
});

test('sliceSegments preserves marks across a boundary; drops partial mentions', () => {
  const segs = [{ text: 'Hello ', marks: [] }, { text: 'world', marks: ['bold'] }];
  expect(sliceSegments(segs, 3, 8)).toEqual([{ text: 'lo ', marks: [] }, { text: 'wo', marks: ['bold'] }]);
  const m = [{ text: '@Jane', marks: [], mention: { contactId: 'c1' } }];
  expect(sliceSegments(m, 0, 3)[0].mention).toBe(undefined);
  expect(sliceSegments(m, 0, 5)[0].mention).toEqual({ contactId: 'c1' });
});

test('normalizeSegments merges + drops empties; concatSegments joins at the seam', () => {
  expect(normalizeSegments([{ text: 'a', marks: [] }, { text: '', marks: [] }, { text: 'b', marks: [] }]))
    .toEqual([{ text: 'ab', marks: [] }]);
  expect(concatSegments([{ text: 'foo', marks: [] }], [{ text: 'bar', marks: [] }]))
    .toEqual([{ text: 'foobar', marks: [] }]);
});

test('segmentsToHTML escapes + nests marks; links + mentions render', () => {
  expect(segmentsToHTML([{ text: 'a & b', marks: ['bold'] }])).toBe('<strong>a &amp; b</strong>');
  expect(segmentsToHTML([{ text: 'x', marks: ['bold', 'italic'] }])).toBe('<em><strong>x</strong></em>');
  expect(segmentsToHTML([{ text: 'go', marks: [], link: 'http://a.com' }])).toBe('<a href="http://a.com">go</a>');
  expect(segmentsToHTML([{ text: '@J', marks: [], mention: { contactId: 'c1' } }])).toContain('data-contact-id="c1"');
});

test('setSegmentColor sets and clears color/background on a range', () => {
  const base = [{ text: 'Hello world', marks: [] }];
  const colored = setSegmentColor(base, 6, 11, 'color', 'red');
  expect(colored).toEqual([
    { text: 'Hello ', marks: [] },
    { text: 'world', marks: [], color: 'red' },
  ]);
  // renders as an inline style span in both exporters
  expect(segmentsToHTML(colored)).toBe('Hello <span style="color:#c4554d">world</span>');
  expect(segmentsToMarkdown(colored)).toBe('Hello <span style="color:#c4554d">world</span>');
  // adds a second (background) field, then clears the color with `default`
  const withBg = setSegmentColor(colored, 6, 11, 'background', 'yellow');
  const cleared = setSegmentColor(withBg, 6, 11, 'color', 'default');
  expect(cleared).toEqual([
    { text: 'Hello ', marks: [] },
    { text: 'world', marks: [], background: 'yellow' },
  ]);
});

test('adjacent differently-colored segments do not merge', () => {
  let segs = setSegmentColor([{ text: 'abcdef', marks: [] }], 0, 3, 'color', 'red');
  segs = setSegmentColor(segs, 3, 6, 'color', 'blue');
  expect(segs.map((s) => s.color)).toEqual(['red', 'blue']);
});

test('setLinkOnRange applies then clears a link', () => {
  const linked = setLinkOnRange([{ text: 'go home', marks: [] }], 0, 2, 'http://a.com');
  expect(linked).toEqual([{ text: 'go', marks: ['link'], link: 'http://a.com' }, { text: ' home', marks: [] }]);
  expect(setLinkOnRange(linked, 0, 2, '')).toEqual([{ text: 'go home', marks: [] }]);
});

test('indentBlock nests under the previous sibling', () => {
  const blocks = [
    { id: 'a', type: 'paragraph', data: { segments: [] }, children: [] },
    { id: 'b', type: 'paragraph', data: { segments: [] }, children: [] },
  ];
  expect(indentBlock(blocks, 'b')).toBe(true);
  expect(findBlock(blocks, 'b').parent.id).toBe('a');
});

test('mergeInto concatenates and returns the join offset', () => {
  const prev = { id: 'p', data: { segments: [{ text: 'foo', marks: [] }] }, children: [] };
  const cur = { id: 'q', data: { segments: [{ text: 'bar', marks: [] }] }, children: [] };
  expect(mergeInto(prev, cur)).toBe(3);
  expect(prev.data.segments.map((s) => s.text).join('')).toBe('foobar');
});

test('turnInto converts within a group and carries segments; cross-group is refused', () => {
  clearRegistry();
  registerBlock({ type: 'paragraph', group: 'text', editableText: true, create: (d) => ({ segments: d.segments || [{ text: '', marks: [] }] }) });
  registerBlock({ type: 'heading-1', group: 'text', editableText: true, create: (d) => ({ segments: d.segments || [{ text: '', marks: [] }] }) });
  registerBlock({ type: 'checklist', group: 'text', listMarker: 'check', create: (d) => ({ segments: d.segments || [{ text: '', marks: [] }], checked: Boolean(d.checked) }) });
  registerBlock({ type: 'divider', group: null, create: () => ({}) });

  expect(canTurnInto('paragraph', 'heading-1')).toBe(true);
  expect(canTurnInto('paragraph', 'divider')).toBe(false);
  expect(turnIntoTargets('paragraph').map((d) => d.type).sort()).toEqual(['checklist', 'heading-1', 'paragraph']);

  const block = { id: 'b', type: 'paragraph', data: { segments: [{ text: 'keep', marks: [] }] }, props: {}, children: [] };
  expect(turnInto(block, 'checklist')).toBe(true);
  expect(block.type).toBe('checklist');
  expect(block.data.checked).toBe(false);
  expect(block.data.segments).toEqual([{ text: 'keep', marks: [] }]);
  expect(turnInto(block, 'divider')).toBe(false); // cross-group
  expect(turnInto(block, 'checklist')).toBe(false); // already that type
});

test('cloneWithIds deep-copies and reids the subtree', () => {
  let n = 0;
  const makeId = () => `new-${(n += 1)}`;
  const original = { id: 'r', type: 'paragraph', data: { segments: [{ text: 'a', marks: [] }] }, props: {}, children: [{ id: 'c', type: 'paragraph', data: { segments: [] }, props: {}, children: [] }] };
  const copy = cloneWithIds(original, makeId);
  expect(flattenBlocks([copy]).map((b) => b.id)).toEqual(['new-1', 'new-2']);
  copy.data.segments[0].text = 'changed';
  expect(original.data.segments[0].text).toBe('a'); // deep copy
});

test('headingLevel + visibleAfterCollapse hide a collapsed heading region', () => {
  const h = (id, lvl, c = false) => ({ id, type: `heading-${lvl}`, props: c ? { collapsed: true } : {} });
  const p = (id) => ({ id, type: 'paragraph', props: {} });
  expect(headingLevel('heading-2')).toBe(2);
  expect(headingLevel('paragraph')).toBe(0);
  // h1(collapsed) p p h2 p h1 -> h1, h1
  expect(visibleAfterCollapse([h('a', 1, true), p('a1'), p('a2'), h('a3', 2), p('a4'), h('b', 1)]).map((x) => x.id)).toEqual(['a', 'b']);
  // a collapsed h2 hides its region but a following h1 shows
  expect(visibleAfterCollapse([h('a', 1), h('b', 2, true), p('b1'), h('c', 1), p('c1')]).map((x) => x.id)).toEqual(['a', 'b', 'c', 'c1']);
});

test('toggle/callout export handle children', () => {
  clearRegistry();
  registerBlock({ type: 'paragraph', group: 'text', create: (d) => ({ segments: d.segments || [] }), toMarkdown: (b, h) => h.renderSegments(b.data.segments), toHTML: (b, h) => `<p>${h.renderSegments(b.data.segments)}</p>` });
  registerBlock({
    type: 'toggle', group: 'text', collapsibleChildren: true,
    create: (d) => ({ segments: d.segments || [] }),
    toMarkdown: (b, h) => { const line = `- ${h.renderSegments(b.data.segments)}`; const k = h.renderChildren(b); return k ? `${line}\n${k}` : line; },
    toHTML: (b, h) => `<details${b.props && b.props.collapsed ? '' : ' open'}><summary>${h.renderSegments(b.data.segments)}</summary>${h.renderChildren(b)}</details>`,
  });
  const child = { id: 'c', type: 'paragraph', data: { segments: [{ text: 'inside', marks: [] }] }, props: {}, children: [] };
  const tog = { id: 't', type: 'toggle', data: { segments: [{ text: 'More', marks: [] }] }, props: {}, children: [child] };
  expect(toMarkdown({ blocks: [tog] })).toBe('- More\n  inside\n');
  expect(toHTML({ blocks: [tog] })).toBe('<details open><summary>More</summary><p>inside</p></details>');
});

test('youtubeId extracts ids from watch/short/embed URLs', () => {
  expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(youtubeId('https://example.com/x')).toBe(null);
});

test('table + toc exporters (via registered built-ins)', async () => {
  clearRegistry();
  const { registerBuiltins } = await import('../blocks/index.js');
  registerBuiltins();
  const cell = (t) => [{ text: t, marks: [] }];
  const table = { id: 't', type: 'table', data: { rows: [[cell('A'), cell('B')], [cell('1'), cell('2')]] }, props: {}, children: [] };
  expect(toMarkdown({ blocks: [table] })).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  expect(toHTML({ blocks: [table] })).toBe('<table class="sc-table"><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>');

  const doc = {
    blocks: [
      { id: 'h1', type: 'heading-1', data: { segments: [{ text: 'Intro', marks: [] }] }, props: {}, children: [] },
      { id: 'h2', type: 'heading-2', data: { segments: [{ text: 'Details', marks: [] }] }, props: {}, children: [] },
      { id: 'toc', type: 'toc', data: {}, props: {}, children: [] },
    ],
  };
  expect(toMarkdown(doc).includes('- Intro')).toBe(true);
  expect(toMarkdown(doc).includes('  - Details')).toBe(true);
  expect(toHTML(doc)).toContain('<a href="#h1">Intro</a>');

  const img = { id: 'i', type: 'image', data: { url: 'http://x/a.png', caption: '', width: 320, align: 'center' }, props: {}, children: [] };
  expect(toHTML({ blocks: [img] })).toContain('style="width:320px"');
});

test('columns + page-link export (via registered built-ins)', async () => {
  clearRegistry();
  const { registerBuiltins } = await import('../blocks/index.js');
  registerBuiltins();
  const p = (id, t) => ({ id, type: 'paragraph', data: { segments: [{ text: t, marks: [] }] }, props: {}, children: [] });
  const cols = {
    id: 'cols', type: 'columns', data: {}, props: {},
    children: [
      { id: 'cA', type: 'column', data: {}, props: {}, children: [p('l', 'left one'), p('l2', 'left two')] },
      { id: 'cB', type: 'column', data: {}, props: {}, children: [p('r', 'right one')] },
    ],
  };
  expect(toMarkdown({ blocks: [cols] })).toBe('left one\n\nleft two\n\nright one\n');
  expect(toHTML({ blocks: [cols] })).toBe(
    '<div class="sc-columns"><div class="sc-column"><p>left one</p><p>left two</p></div><div class="sc-column"><p>right one</p></div></div>',
  );

  const link = { id: 'pl', type: 'page-link', data: { docId: 'doc-9', title: 'Roadmap' }, props: {}, children: [] };
  expect(toMarkdown({ blocks: [link] })).toBe('[Roadmap](?doc=doc-9)\n');
  expect(toHTML({ blocks: [link] })).toContain('href="?doc=doc-9"');
});

test('a registered custom block exports through the driver (extension path)', () => {
  clearRegistry();
  registerBlock({
    type: 'contact',
    toMarkdown: (b) => { const c = b.data.contact; return c ? `**${c.name}** <${c.email}>` : ''; },
    toHTML: (b) => { const c = b.data.contact; return c ? `<div class="sc-contact">${c.name}</div>` : ''; },
  });
  const blk = { id: 'k', type: 'contact', data: { contact: { name: 'Jane', email: 'j@x.ca' } }, props: {}, children: [] };
  expect(toMarkdown({ blocks: [blk] })).toBe('**Jane** <j@x.ca>\n');
  expect(toHTML({ blocks: [blk] })).toBe('<div class="sc-contact">Jane</div>');
  const empty = { id: 'k', type: 'contact', data: { contact: null }, props: {}, children: [] };
  expect(toHTML({ blocks: [empty] })).toBe('');
});

test('exporter walks the tree and groups lists', () => {
  clearRegistry();
  registerBlock({ type: 'heading-1', toMarkdown: (b, h) => `# ${h.renderSegments(b.data.segments)}`, toHTML: (b, h) => `<h1>${h.renderSegments(b.data.segments)}</h1>` });
  registerBlock({ type: 'bulleted-list', listMarker: 'bullet', toMarkdown: (b, h) => `- ${h.renderSegments(b.data.segments)}`, toHTML: (b, h) => `<li>${h.renderSegments(b.data.segments)}</li>` });
  const p = (id, t, type) => ({ id, type, data: { segments: [{ text: t, marks: [] }] }, children: [] });
  const doc = { blocks: [p('h', 'T', 'heading-1'), p('a', 'one', 'bulleted-list'), p('b', 'two', 'bulleted-list')] };
  expect(toMarkdown(doc)).toBe('# T\n\n- one\n- two\n');
  expect(toHTML(doc)).toBe('<h1>T</h1><ul><li>one</li><li>two</li></ul>');
});
