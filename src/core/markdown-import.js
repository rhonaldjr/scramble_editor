// Markdown → block descriptors. Mirrors core/html-import.js: returns an array of
// `{ type, data }` the editor turns into real blocks via `createBlock`. Pure and
// framework-free (Vitest-covered). Handles the common CommonMark subset the
// exporter produces — headings, lists (incl. to-do), quote, fenced code, hr,
// block images, and inline bold/italic/code/strike/links.

import { normalizeSegments } from './segments.js';

// --- inline ---------------------------------------------------------------

// Protect backslash-escaped punctuation so it isn't parsed as a marker, then
// restore it to the literal character. NUL-delimited codepoints can't collide
// with real digits in the text.
function protectEscapes(text) {
  return text.replace(/\\([\\`*_[\]~()])/g, (_, ch) => '\x00' + ch.charCodeAt(0) + '\x00');
}
function restoreEscapes(text) {
  return text.replace(/\x00(\d+)\x00/g, (_, code) => String.fromCharCode(Number(code)));
}

const INLINE = [
  { re: /`([^`]+)`/, mark: 'code' },
  { re: /\*\*([^*]+)\*\*/, mark: 'bold' },
  { re: /__([^_]+)__/, mark: 'bold' },
  { re: /~~([^~]+)~~/, mark: 'strikethrough' },
  { re: /\*([^*]+)\*/, mark: 'italic' },
  { re: /_([^_]+)_/, mark: 'italic' },
  { re: /\[([^\]]+)\]\(([^)]+)\)/, link: true },
];

function parseInlineRaw(text, marks) {
  let best = null;
  for (const p of INLINE) {
    const m = p.re.exec(text);
    if (m && (best === null || m.index < best.m.index)) best = { p, m };
  }
  if (!best) return text ? [{ text, marks: [...marks] }] : [];
  const { p, m } = best;
  const out = [];
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length);
  if (before) out.push({ text: before, marks: [...marks] });
  if (p.link) {
    for (const seg of parseInlineRaw(m[1], marks)) {
      out.push({ ...seg, marks: seg.marks.includes('link') ? seg.marks : [...seg.marks, 'link'], link: m[2] });
    }
  } else if (p.mark === 'code') {
    out.push({ text: m[1], marks: [...marks, 'code'] }); // code spans aren't re-parsed
  } else {
    out.push(...parseInlineRaw(m[1], [...marks, p.mark]));
  }
  out.push(...parseInlineRaw(after, marks));
  return out;
}

export function parseInline(text) {
  const segs = parseInlineRaw(protectEscapes(text), []);
  segs.forEach((s) => { s.text = restoreEscapes(s.text); });
  return normalizeSegments(segs);
}

// --- block ----------------------------------------------------------------

const HEADING = { 1: 'heading-1', 2: 'heading-2', 3: 'heading-3', 4: 'heading-3', 5: 'heading-3', 6: 'heading-3' };
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

export function markdownToBlocks(md) {
  const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];      // accumulating plain paragraph lines
  let quote = [];     // accumulating blockquote lines

  const flushPara = () => {
    if (para.length) { blocks.push({ type: 'paragraph', data: { segments: parseInline(para.join(' ')) } }); para = []; }
  };
  const flushQuote = () => {
    if (quote.length) { blocks.push({ type: 'quote', data: { segments: parseInline(quote.join(' ')) } }); quote = []; }
  };
  const flush = () => { flushPara(); flushQuote(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // fenced code block
    const fence = /^```(.*)$/.exec(line);
    if (fence) {
      flush();
      const language = fence[1].trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      blocks.push({ type: 'code', data: { code: buf.join('\n'), language } });
      continue;
    }

    if (line.trim() === '') { flush(); continue; }

    // horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ type: 'divider', data: {} }); continue; }

    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ type: HEADING[h[1].length], data: { segments: parseInline(h[2].trim()) } }); continue; }

    // block image (on its own line)
    const img = IMAGE_LINE.exec(line);
    if (img) { flush(); blocks.push({ type: 'image', data: { url: img[2], caption: img[1] } }); continue; }

    // blockquote
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) { flushPara(); quote.push(q[1]); continue; }
    flushQuote();

    // to-do item
    const todo = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (todo) { flushPara(); blocks.push({ type: 'checklist', data: { segments: parseInline(todo[2]), checked: todo[1].toLowerCase() === 'x' } }); continue; }

    // bulleted item
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) { flushPara(); blocks.push({ type: 'bulleted-list', data: { segments: parseInline(bullet[1]) } }); continue; }

    // numbered item
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (num) { flushPara(); blocks.push({ type: 'numbered-list', data: { segments: parseInline(num[1]) } }); continue; }

    // plain paragraph text (consecutive lines merge)
    para.push(line.trim());
  }
  flush();
  return blocks;
}
