// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { htmlToBlocks, textToBlocks } from './html-import.js';

test('rich HTML becomes structured blocks, not one flattened paragraph', () => {
  const html = `
    <div>
      <h1>Title CEDD</h1>
      <p>Winter operations <strong>don't</strong> mean delays.</p>
      <ul><li>First</li><li>Second</li></ul>
      <blockquote>Trusted</blockquote>
      <hr>
      <pre>code();</pre>
    </div>`;
  const blocks = htmlToBlocks(html);
  expect(blocks.map((b) => b.type)).toEqual([
    'heading-1', 'paragraph', 'bulleted-list', 'bulleted-list', 'quote', 'divider', 'code',
  ]);
  // heading and following paragraph stay separate (no "CEDDWinter" merge)
  expect(blocks[0].data.segments.map((s) => s.text).join('')).toBe('Title CEDD');
  expect(blocks[1].data.segments.map((s) => s.text).join('')).toBe("Winter operations don't mean delays.");
});

test('preserves marks + links but drops stray inline colors', () => {
  const html = '<p>a <strong>b</strong> <a href="http://x">c</a> <span style="color:red">d</span></p>';
  const [para] = htmlToBlocks(html);
  const bold = para.data.segments.find((s) => s.marks.includes('bold'));
  const link = para.data.segments.find((s) => s.link);
  expect(bold.text).toBe('b');
  expect(link.link).toBe('http://x');
  expect(para.data.segments.some((s) => s.color || s.background)).toBe(false);
});

test('collapses source whitespace/newlines to single spaces', () => {
  const html = '<p>Winter   operations\n     don’t   have</p>';
  const [para] = htmlToBlocks(html);
  expect(para.data.segments.map((s) => s.text).join('')).toBe('Winter operations don’t have');
});

test('parses tables into cell-segment rows and images into image blocks', () => {
  const blocks = htmlToBlocks('<table><tr><td>1</td><td>2</td></tr></table><img src="p.png" alt="c">');
  const table = blocks.find((b) => b.type === 'table');
  const image = blocks.find((b) => b.type === 'image');
  expect(table.data.rows).toEqual([[[{ text: '1', marks: [] }], [{ text: '2', marks: [] }]]]);
  expect(image.data).toEqual({ url: 'p.png', caption: 'c' });
});

test('textToBlocks splits plain text on newlines', () => {
  expect(textToBlocks('a\nb').map((b) => b.data.segments[0].text)).toEqual(['a', 'b']);
});
