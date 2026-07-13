// Rich-text segments. Inline formatting is stored as marks in block data, never
// as raw HTML (CLAUDE.md rule 4). Pure functions — no DOM — so exporters,
// splitting, and merging are all unit-testable in Node.

/**
 * @typedef {Object} Segment
 * @property {string} text
 * @property {string[]} marks           e.g. ['bold','italic']
 * @property {string} [link]            href when marks includes 'link'
 * @property {{contactId:string}} [mention]
 */

/** Build a segment with an independent marks array. */
export function createSegment(text = '', marks = [], extra = {}) {
  return { text, marks: [...marks], ...extra };
}

/** Order-independent equality of two mark lists. */
export function marksEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((m) => set.has(m));
}

/** True when two segments carry identical formatting (so they can be merged). */
function sameFormatting(a, b) {
  if (a.mention || b.mention) return false;
  if ((a.link || null) !== (b.link || null)) return false;
  return marksEqual(a.marks, b.marks);
}

/**
 * Collapse a segment list to canonical form: drop empties, merge adjacent
 * segments with matching formatting. Always returns at least one segment so a
 * block is never segment-less.
 * @param {Segment[]} segments
 * @returns {Segment[]}
 */
export function normalizeSegments(segments) {
  const out = [];
  for (const seg of segments) {
    if (!seg || seg.text === '') continue;
    const prev = out[out.length - 1];
    if (prev && sameFormatting(prev, seg)) {
      prev.text += seg.text;
    } else {
      out.push({ ...seg, marks: [...(seg.marks || [])] });
    }
  }
  if (out.length === 0) out.push(createSegment(''));
  return out;
}

/** Concatenate the plain text of a segment list. */
export function segmentsText(segments) {
  return segments.map((s) => s.text).join('');
}

/** Plain-text length of a segment list. */
export function segmentsLength(segments) {
  return segmentsText(segments).length;
}

/** True when a segment list holds no visible text. */
export function isEmptySegments(segments) {
  return segmentsLength(segments) === 0;
}

/**
 * Return the segments covering the plain-text range [start, end), preserving
 * marks. A mention survives only when its whole segment is inside the range.
 */
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

/**
 * Split a segment list at a plain-text offset into [before, after]. Used by
 * Enter-to-split. Offset is clamped into range.
 */
export function splitSegmentsAt(segments, offset) {
  const len = segmentsLength(segments);
  const at = Math.max(0, Math.min(offset, len));
  return [sliceSegments(segments, 0, at), sliceSegments(segments, at, len)];
}

/** Join two segment lists (Backspace-to-merge), normalized. */
export function concatSegments(a, b) {
  return normalizeSegments([...a, ...b]);
}

function escapeHTML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/"/g, '&quot;');
}

// Applied inner-to-outer so the first entry ends up as the innermost tag.
const MARK_TAGS = [
  ['code', 'code'],
  ['bold', 'strong'],
  ['italic', 'em'],
  ['underline', 'u'],
  ['strikethrough', 's'],
];

/**
 * Render segments to an HTML string for view mode and contenteditable seeding.
 * The segments remain the source of truth; this is a projection of them.
 */
export function segmentsToHTML(segments) {
  return segments
    .map((seg) => {
      let html = escapeHTML(seg.text);
      const marks = seg.marks || [];
      for (const [mark, tag] of MARK_TAGS) {
        if (marks.includes(mark)) html = `<${tag}>${html}</${tag}>`;
      }
      if (seg.link) html = `<a href="${escapeAttr(seg.link)}">${html}</a>`;
      if (seg.mention) {
        const id = escapeAttr(seg.mention.contactId || '');
        html = `<span class="sc-mention" data-contact-id="${id}">${html}</span>`;
      }
      return html;
    })
    .join('');
}

function escapeMarkdown(text) {
  return text.replace(/([\\`*_[\]])/g, '\\$1');
}

/**
 * Render segments to inline Markdown. Code spans wrap raw text; other marks
 * nest around escaped text; links wrap last. Pure — used by the exporter.
 */
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
      if (seg.link) out = `[${out}](${seg.link})`;
      return out;
    })
    .join('');
}

/**
 * Rebuild a segment list, applying `transform` to each segment inside the
 * plain-text range [start, end). Segments outside the range are untouched.
 * Used by all inline-formatting operations. Pure.
 */
export function mapRangeSegments(segments, start, end, transform) {
  const len = segmentsLength(segments);
  const s = Math.max(0, Math.min(start, len));
  const e = Math.max(s, Math.min(end, len));
  const before = sliceSegments(segments, 0, s);
  const middle = sliceSegments(segments, s, e).map((seg) => transform(seg));
  const after = sliceSegments(segments, e, len);
  return normalizeSegments([...before, ...middle, ...after]);
}

/** True when every text-bearing segment in [start, end) already has `mark`. */
export function rangeHasMark(segments, start, end, mark) {
  const middle = sliceSegments(segments, start, end).filter((s) => s.text !== '');
  if (middle.length === 0) return false;
  return middle.every((s) => s.marks.includes(mark));
}

/** Add or remove `mark` across [start, end). */
export function setMarkOnRange(segments, start, end, mark, on) {
  return mapRangeSegments(segments, start, end, (seg) => {
    const has = seg.marks.includes(mark);
    if (on && !has) return { ...seg, marks: [...seg.marks, mark] };
    if (!on && has) return { ...seg, marks: seg.marks.filter((m) => m !== mark) };
    return seg;
  });
}

/** Toggle `mark` across [start, end): remove it when the whole range has it. */
export function toggleMark(segments, start, end, mark) {
  const on = !rangeHasMark(segments, start, end, mark);
  return setMarkOnRange(segments, start, end, mark, on);
}

/** Apply (href truthy) or clear (href falsy) a link across [start, end). */
export function setLinkOnRange(segments, start, end, href) {
  return mapRangeSegments(segments, start, end, (seg) => {
    if (href) {
      const marks = seg.marks.includes('link') ? seg.marks : [...seg.marks, 'link'];
      return { ...seg, marks, link: href };
    }
    const next = { ...seg, marks: seg.marks.filter((m) => m !== 'link') };
    delete next.link;
    return next;
  });
}
