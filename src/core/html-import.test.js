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

test('imports Word/Office paste: heading styles, mso-list items, inline-style marks', () => {
  const word = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office">
    <head><style><!-- p.MsoNormal{margin:0} --></style></head>
    <body><div class=WordSection1>
      <!--[if gte mso 9]><xml><o:DocumentProperties/></xml><![endif]-->
      <p class=MsoTitle>Report<o:p></o:p></p>
      <p class=MsoHeading2>Section<o:p></o:p></p>
      <p class=MsoNormal>Has <b>bold</b> and <span style='font-style:italic'>italic</span>.</p>
      <p class=MsoListParagraphCxSpFirst style='mso-list:l0 level1 lfo1'>
        <![if !supportLists]><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span><![endif]>Step one</p>
      <p class=MsoListParagraph style='mso-list:l1 level1 lfo2'>
        <![if !supportLists]><span style='mso-list:Ignore'>&middot;<span>&nbsp;</span></span><![endif]>A bullet</p>
      <p class=MsoNormal><o:p>&nbsp;</o:p></p>
    </div></body></html>`;
  const blocks = htmlToBlocks(word);
  expect(blocks.map((b) => b.type)).toEqual([
    'heading-1', 'heading-2', 'paragraph', 'numbered-list', 'bulleted-list',
  ]);
  // MSO cruft (style/xml/o:p) dropped; bullet glyph stripped from the list text
  expect(blocks[3].data.segments.map((s) => s.text).join('')).toBe('Step one');
  expect(blocks[4].data.segments.map((s) => s.text).join('')).toBe('A bullet');
  // bold from <b>, italic from inline style
  const para = blocks[2].data.segments;
  expect(para.find((s) => s.text === 'bold').marks).toContain('bold');
  expect(para.find((s) => s.text === 'italic').marks).toContain('italic');
});

test('reads bold/underline/strike from inline styles (Google Docs style spans)', () => {
  const html = '<p><span style="font-weight:700">a</span><span style="text-decoration:line-through">b</span></p>';
  const [para] = htmlToBlocks(html);
  expect(para.data.segments.find((s) => s.text === 'a').marks).toContain('bold');
  expect(para.data.segments.find((s) => s.text === 'b').marks).toContain('strikethrough');
});

test('textToBlocks splits plain text on newlines', () => {
  expect(textToBlocks('a\nb').map((b) => b.data.segments[0].text)).toEqual(['a', 'b']);
});
