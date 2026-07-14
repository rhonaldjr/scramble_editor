// Rich-text segments — inline formatting stored as marks in data, never raw
// HTML. Pure functions; unit-testable, framework-free.
//
// A segment is { text, marks: string[], link?, mention?, color?, background? }.
// `color`/`background` are palette tokens (see colors.js), resolved to CSS here.

import { TEXT_COLORS, BG_COLORS } from './colors.js';

export function createSegment(text = '', marks = [], extra = {}) {
  return { text, marks: [...marks], ...extra };
}

export function marksEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((m) => set.has(m));
}

function sameFormatting(a, b) {
  if (a.mention || b.mention) return false;
  if ((a.link || null) !== (b.link || null)) return false;
  if ((a.color || null) !== (b.color || null)) return false;
  if ((a.background || null) !== (b.background || null)) return false;
  return marksEqual(a.marks, b.marks);
}

export function normalizeSegments(segments) {
  const out = [];
  for (const seg of segments) {
    if (!seg || seg.text === '') continue;
    const prev = out[out.length - 1];
    if (prev && sameFormatting(prev, seg)) prev.text += seg.text;
    else out.push({ ...seg, marks: [...(seg.marks || [])] });
  }
  if (out.length === 0) out.push(createSegment(''));
  return out;
}

export function segmentsText(segments) {
  return segments.map((s) => s.text).join('');
}

export function segmentsLength(segments) {
  return segmentsText(segments).length;
}

export function isEmptySegments(segments) {
  return segmentsLength(segments) === 0;
}

export function sliceSegments(segments, start, end) {
  const out = [];
  let pos = 0;
  for (const seg of segments) {
    const segStart = pos;
    const segEnd = pos + seg.text.length;
    pos = segEnd;
    if (segEnd <= start || segStart >= end) continue;
    const from = Math.max(start, segStart) - segStart;
    const to = Math.min(end, segEnd) - segStart;
    const text = seg.text.slice(from, to);
    if (text === '') continue;
    const piece = { ...seg, text, marks: [...(seg.marks || [])] };
    if (piece.mention && !(segStart >= start && segEnd <= end)) delete piece.mention;
    out.push(piece);
  }
  return normalizeSegments(out);
}

export function splitSegmentsAt(segments, offset) {
  const len = segmentsLength(segments);
  const at = Math.max(0, Math.min(offset, len));
  return [sliceSegments(segments, 0, at), sliceSegments(segments, at, len)];
}

export function concatSegments(a, b) {
  return normalizeSegments([...a, ...b]);
}

function escapeHTML(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(value) {
  return escapeHTML(value).replace(/"/g, '&quot;');
}

const MARK_TAGS = [
  ['code', 'code'],
  ['bold', 'strong'],
  ['italic', 'em'],
  ['underline', 'u'],
  ['strikethrough', 's'],
];

export function segmentsToHTML(segments) {
  return segments
    .map((seg) => {
      let html = escapeHTML(seg.text);
      const marks = seg.marks || [];
      for (const [mark, tag] of MARK_TAGS) {
        if (marks.includes(mark)) html = `<${tag}>${html}</${tag}>`;
      }
      const style = colorStyle(seg);
      if (style) html = `<span style="${style}">${html}</span>`;
      if (seg.link) html = `<a href="${escapeAttr(seg.link)}">${html}</a>`;
      if (seg.mention) {
        html = `<span class="sc-mention" data-contact-id="${escapeAttr(seg.mention.contactId || '')}">${html}</span>`;
      }
      return html;
    })
    .join('');
}

function escapeMarkdown(text) {
  return text.replace(/([\\`*_[\]])/g, '\\$1');
}

export function segmentsToMarkdown(segments) {
  return segments
    .map((seg) => {
      const marks = seg.marks || [];
      let out;
      if (marks.includes('code')) {
        out = `\`${seg.text}\``;
      } else {
        out = escapeMarkdown(seg.text);
        if (marks.includes('bold')) out = `**${out}**`;
        if (marks.includes('italic')) out = `*${out}*`;
        if (marks.includes('strikethrough')) out = `~~${out}~~`;
        if (marks.includes('underline')) out = `<u>${out}</u>`;
      }
      const style = colorStyle(seg);
      if (style) out = `<span style="${style}">${out}</span>`;
      if (seg.link) out = `[${out}](${seg.link})`;
      return out;
    })
    .join('');
}

// Resolve a segment's color/background tokens to a CSS style string (or '').
function colorStyle(seg) {
  const parts = [];
  const c = TEXT_COLORS[seg.color];
  const bg = BG_COLORS[seg.background];
  if (c) parts.push(`color:${c}`);
  if (bg) parts.push(`background:${bg}`);
  return parts.join(';');
}

/**
 * Set (or clear with a falsy/`default` token) a color field ('color' or
 * 'background') on the plain-text range [start, end).
 */
export function setSegmentColor(segments, start, end, field, token) {
  return mapRange(segments, start, end, (seg) => {
    const next = { ...seg };
    if (token && token !== 'default') next[field] = token;
    else delete next[field];
    return next;
  });
}

function mapRange(segments, start, end, fn) {
  const len = segmentsLength(segments);
  const s = Math.max(0, Math.min(start, len));
  const e = Math.max(s, Math.min(end, len));
  const before = sliceSegments(segments, 0, s);
  const middle = sliceSegments(segments, s, e).map(fn);
  const after = sliceSegments(segments, e, len);
  return normalizeSegments([...before, ...middle, ...after]);
}

export function rangeHasMark(segments, start, end, mark) {
  const middle = sliceSegments(segments, start, end).filter((s) => s.text !== '');
  if (middle.length === 0) return false;
  return middle.every((s) => s.marks.includes(mark));
}

export function toggleMark(segments, start, end, mark) {
  const on = !rangeHasMark(segments, start, end, mark);
  return mapRange(segments, start, end, (seg) => {
    const has = seg.marks.includes(mark);
    if (on && !has) return { ...seg, marks: [...seg.marks, mark] };
    if (!on && has) return { ...seg, marks: seg.marks.filter((m) => m !== mark) };
    return seg;
  });
}

export function setLinkOnRange(segments, start, end, href) {
  return mapRange(segments, start, end, (seg) => {
    if (href) {
      const marks = seg.marks.includes('link') ? seg.marks : [...seg.marks, 'link'];
      return { ...seg, marks, link: href };
    }
    const next = { ...seg, marks: seg.marks.filter((m) => m !== 'link') };
    delete next.link;
    return next;
  });
}
