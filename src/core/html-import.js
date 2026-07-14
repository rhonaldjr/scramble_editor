// HTML → block descriptors. Pasting a rich web page (or a Word / Google Docs /
// Outlook document) should become a *structured* set of blocks (headings,
// paragraphs, lists, quotes, code, tables, images) — not one flattened
// paragraph. Framework-free: uses only DOM APIs (DOMParser, element traversal),
// no Vue. Returns `{ type, data }` descriptors that the editor turns into real
// blocks via `createBlock`.
//
// Office/Word paste is messy: MSO conditional comments, `<style>`/`<xml>`
// blobs, namespaced `<o:p>` tags, heading/list *styles* instead of semantic
// tags, and list items rendered as `<p style="mso-list:…">` with the bullet
// baked into a `mso-list:Ignore` span. We normalize all of that here.
//
// Note: inline *color/background* styling from arbitrary source HTML is
// intentionally dropped — only structural marks (bold/italic/underline/strike/
// code) and links are imported, so pasted text doesn't inherit stray colors.

import { normalizeSegments } from './segments.js';

const TAG_MARKS = {
  STRONG: 'bold', B: 'bold', EM: 'italic', I: 'italic',
  U: 'underline', S: 'strikethrough', STRIKE: 'strikethrough', DEL: 'strikethrough', CODE: 'code',
};

const HEADING = { H1: 'heading-1', H2: 'heading-2', H3: 'heading-3', H4: 'heading-3', H5: 'heading-3', H6: 'heading-3' };

// Word/Docs heading (and title) paragraph styles → heading blocks.
const WORD_HEADING = {
  MsoTitle: 'heading-1', MsoHeading1: 'heading-1', MsoHeading2: 'heading-2',
  MsoHeading3: 'heading-3', MsoHeading4: 'heading-3', MsoHeading5: 'heading-3', MsoHeading6: 'heading-3',
};

// Derive marks from an inline `style` attribute (Word/Docs express bold/italic/
// underline/strike as CSS, not just <b>/<i>/<u>/<s>).
function addStyleMarks(marks, style) {
  if (!style) return marks;
  let out = marks;
  const add = (m) => { if (!out.includes(m)) out = [...out, m]; };
  if (/font-weight\s*:\s*(?:bold|bolder|[6-9]00)\b/i.test(style)) add('bold');
  if (/font-style\s*:\s*italic\b/i.test(style)) add('italic');
  if (/text-decoration[^;]*\bunderline\b/i.test(style)) add('underline');
  if (/text-decoration[^;]*\bline-through\b/i.test(style)) add('strikethrough');
  return out;
}

function wordHeadingType(el) {
  const cls = el.getAttribute ? el.getAttribute('class') || '' : '';
  for (const key of Object.keys(WORD_HEADING)) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(cls)) return WORD_HEADING[key];
  }
  return null;
}

function isWordListParagraph(el) {
  if (!el.getAttribute) return false;
  const style = el.getAttribute('style') || '';
  const cls = el.getAttribute('class') || '';
  return /mso-list\s*:/i.test(style) || /MsoListParagraph/i.test(cls);
}

// A Word list item is ordered when its baked-in bullet glyph is a number.
function isWordListOrdered(el) {
  const marker = el.querySelector ? el.querySelector('span[style*="mso-list"]') : null;
  const glyph = (marker ? marker.textContent : '').trim();
  return /\d/.test(glyph);
}

// Elements that flow inline (accumulate into the current paragraph). Anything
// not listed here and not specially handled is treated as a block container.
const INLINE = new Set([
  'A', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'SUB', 'SUP',
  'SMALL', 'MARK', 'FONT', 'ABBR', 'CITE', 'Q', 'TIME', 'LABEL', 'BR', 'WBR', 'BDI', 'BDO', 'INS',
]);

function segmentsTextLen(segs) {
  return segs.reduce((n, s) => n + s.text.length, 0);
}

// Collapse HTML whitespace (runs → single space) and trim the paragraph edges.
function collapseWhitespace(segments) {
  const out = segments
    .map((s) => ({ ...s, text: s.text.replace(/[\s ]+/g, ' ') }))
    .filter((s) => s.text !== '');
  if (out.length) {
    out[0] = { ...out[0], text: out[0].text.replace(/^ /, '') };
    const last = out.length - 1;
    out[last] = { ...out[last], text: out[last].text.replace(/ $/, '') };
  }
  return normalizeSegments(out.filter((s) => s.text !== ''));
}

// Extract inline segments (marks + links) from an element's subtree.
function inlineSegments(node) {
  const segments = [];
  const walk = (n, marks, link) => {
    n.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        segments.push({ text: child.nodeValue, marks: [...marks], ...(link ? { link } : {}) });
      } else if (child.nodeType === 1) {
        const tag = child.tagName;
        if (tag === 'BR') { segments.push({ text: ' ', marks: [...marks] }); return; }
        // Office namespaced tags (o:p, v:*, w:*) carry no readable content.
        if (tag.includes(':')) return;
        const style = child.getAttribute('style') || '';
        // Word bakes the list bullet/number into a `mso-list:Ignore` span — drop it.
        if (/mso-list\s*:\s*ignore/i.test(style)) return;
        let nextMarks = addStyleMarks(marks, style);
        if (TAG_MARKS[tag] && !nextMarks.includes(TAG_MARKS[tag])) nextMarks = [...nextMarks, TAG_MARKS[tag]];
        const nextLink = tag === 'A' ? (child.getAttribute('href') || link) : link;
        walk(child, nextMarks, nextLink);
      }
    });
  };
  walk(node, [], null);
  return collapseWhitespace(normalizeSegments(segments));
}

// A list item's own text, excluding any nested list (handled separately).
function listItemSegments(li) {
  const buf = [];
  li.childNodes.forEach((n) => {
    if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) return;
    if (n.nodeType === 3) buf.push({ text: n.nodeValue, marks: [] });
    else if (n.nodeType === 1) buf.push(...inlineSegments(n));
  });
  return collapseWhitespace(normalizeSegments(buf));
}

function tableBlock(table) {
  const rows = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const cells = [];
    tr.querySelectorAll('th,td').forEach((cell) => {
      const segs = inlineSegments(cell);
      cells.push(segs.length ? segs : [{ text: '', marks: [] }]);
    });
    if (cells.length) rows.push(cells);
  });
  return rows.length ? { type: 'table', data: { rows } } : null;
}

function pushInline(blocks, type, el) {
  const segs = inlineSegments(el);
  if (segmentsTextLen(segs) > 0) blocks.push({ type, data: { segments: segs } });
}

function handleList(el, blocks) {
  const marker = el.tagName === 'OL' ? 'numbered-list' : 'bulleted-list';
  el.childNodes.forEach((li) => {
    if (li.nodeType !== 1 || li.tagName !== 'LI') return;
    const segs = listItemSegments(li);
    if (segmentsTextLen(segs) > 0) blocks.push({ type: marker, data: { segments: segs } });
    // Nested lists become sibling list blocks (indentation is flattened).
    li.childNodes.forEach((child) => {
      if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) handleList(child, blocks);
    });
  });
}

function handleBlockElement(el, blocks) {
  const tag = el.tagName;
  if (tag.includes(':')) return; // Office namespaced container (o:p, v:*)
  if (HEADING[tag]) { pushInline(blocks, HEADING[tag], el); return; }
  switch (tag) {
    case 'P': {
      const wh = wordHeadingType(el);
      if (wh) { pushInline(blocks, wh, el); return; }
      if (isWordListParagraph(el)) {
        pushInline(blocks, isWordListOrdered(el) ? 'numbered-list' : 'bulleted-list', el);
        return;
      }
      pushInline(blocks, 'paragraph', el);
      return;
    }
    case 'BLOCKQUOTE': pushInline(blocks, 'quote', el); return;
    case 'PRE': {
      const code = el.textContent.replace(/\n$/, '');
      if (code.trim() !== '') blocks.push({ type: 'code', data: { code, language: '' } });
      return;
    }
    case 'HR': blocks.push({ type: 'divider', data: {} }); return;
    case 'UL': case 'OL': handleList(el, blocks); return;
    case 'LI': pushInline(blocks, 'bulleted-list', el); return;
    case 'IMG': {
      const src = el.getAttribute('src');
      if (src) blocks.push({ type: 'image', data: { url: src, caption: el.getAttribute('alt') || '' } });
      return;
    }
    case 'TABLE': { const t = tableBlock(el); if (t) blocks.push(t); return; }
    default:
      // Generic container (DIV, SECTION, ARTICLE, FIGURE, …): recurse so its
      // block descendants keep their own boundaries.
      processChildren(el, blocks);
  }
}

function processChildren(parent, blocks) {
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const segs = collapseWhitespace(normalizeSegments(buf));
    buf = [];
    if (segmentsTextLen(segs) > 0) blocks.push({ type: 'paragraph', data: { segments: segs } });
  };
  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      if (node.nodeValue.trim() !== '') buf.push({ text: node.nodeValue, marks: [] });
      else if (buf.length) buf.push({ text: ' ', marks: [] });
    } else if (node.nodeType === 1) {
      if (INLINE.has(node.tagName)) buf.push(...inlineSegments(node));
      else { flush(); handleBlockElement(node, blocks); }
    }
  });
  flush();
}

// Turn a parsed DOM root into block descriptors (testable with jsdom).
export function nodeToBlocks(root) {
  const blocks = [];
  processChildren(root, blocks);
  return blocks;
}

// Parse an HTML string (clipboard payload) into block descriptors.
export function htmlToBlocks(html) {
  if (!html || typeof DOMParser === 'undefined') return [];
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.body.querySelectorAll('script,style,noscript,template,xml,title,meta,link').forEach((n) => n.remove());
  return nodeToBlocks(parsed.body);
}

// Split plain text into paragraph descriptors (blank lines already collapsed).
export function textToBlocks(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => ({ type: 'paragraph', data: { segments: [{ text: line, marks: [] }] } }));
}
