import { test, expect } from 'vitest';
import { markdownToBlocks, parseInline } from './markdown-import.js';

test('parses block structure: headings, lists, quote, code, hr, image', () => {
  const md = [
    '# Title',
    '',
    'A paragraph.',
    '',
    '- one',
    '- two',
    '- [x] done',
    '- [ ] todo',
    '',
    '1. first',
    '2. second',
    '',
    '> quoted',
    '',
    '```js',
    'const x = 1;',
    '```',
    '',
    '---',
    '',
    '![cap](http://x/y.png)',
  ].join('\n');
  const blocks = markdownToBlocks(md);
  expect(blocks.map((b) => b.type)).toEqual([
    'heading-1', 'paragraph',
    'bulleted-list', 'bulleted-list', 'checklist', 'checklist',
    'numbered-list', 'numbered-list',
    'quote', 'code', 'divider', 'image',
  ]);
  expect(blocks[4].data).toEqual({ segments: [{ text: 'done', marks: [] }], checked: true });
  expect(blocks[5].data.checked).toBe(false);
  expect(blocks[9].data).toEqual({ code: 'const x = 1;', language: 'js' });
  expect(blocks[11].data).toEqual({ url: 'http://x/y.png', caption: 'cap' });
});

test('parses inline marks and links without corrupting digits', () => {
  const segs = parseInline('Year 2024: **bold**, *italic*, `code`, ~~x~~ and [go](http://a.com).');
  expect(segs.find((s) => s.text === '2024: ' || s.text.startsWith('Year'))).toBeTruthy();
  expect(segs.find((s) => s.marks.includes('bold')).text).toBe('bold');
  expect(segs.find((s) => s.marks.includes('italic')).text).toBe('italic');
  expect(segs.find((s) => s.marks.includes('code')).text).toBe('code');
  expect(segs.find((s) => s.marks.includes('strikethrough')).text).toBe('x');
  const link = segs.find((s) => s.link);
  expect(link.link).toBe('http://a.com');
  expect(link.text).toBe('go');
  // full text preserved (digits intact)
  expect(segs.map((s) => s.text).join('')).toBe('Year 2024: bold, italic, code, x and go.');
});

test('honors backslash escapes (literal markers, digits kept)', () => {
  const segs = parseInline('Escaped \\*not italic\\* and price 2024.');
  expect(segs.length).toBe(1);
  expect(segs[0].marks).toEqual([]);
  expect(segs[0].text).toBe('Escaped *not italic* and price 2024.');
});

test('consecutive plain lines merge into one paragraph', () => {
  const blocks = markdownToBlocks('line one\nline two\n\nsecond para');
  expect(blocks.length).toBe(2);
  expect(blocks[0].data.segments[0].text).toBe('line one line two');
});
