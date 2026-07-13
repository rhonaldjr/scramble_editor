// Caret and selection helpers shared by editing, slash menu, shortcuts, and
// toolbar. Translates between DOM ranges and plain-text offsets within a
// content element. Browser-only.

/** Nearest contenteditable content element for a node, or null. */
export function contentEl(node) {
  if (!node) return null;
  const el = node.nodeType === 3 ? node.parentElement : node;
  return el ? el.closest('[data-role="content"]') : null;
}

/** Block id owning an element, or null. */
export function blockIdOf(el) {
  const wrapper = el ? el.closest('.sc-block') : null;
  return wrapper ? wrapper.dataset.blockId : null;
}

/** Plain-text offset of the caret (selection end) within a content element. */
export function caretOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

export function caretIsCollapsed() {
  const sel = window.getSelection();
  return !sel || sel.isCollapsed;
}

/** Find the text node + local offset for a plain-text offset within `el`. */
function locate(el, offset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let remaining = offset;
  let last = null;
  let node = walker.nextNode();
  while (node) {
    last = node;
    if (node.nodeValue.length >= remaining) return { node, offset: remaining };
    remaining -= node.nodeValue.length;
    node = walker.nextNode();
  }
  return last ? { node: last, offset: last.nodeValue.length } : null;
}

/** Collapse the caret at a plain-text offset within a content element. */
export function setCaret(el, offset) {
  const sel = window.getSelection();
  const range = document.createRange();
  const spot = locate(el, offset);
  if (spot) range.setStart(spot.node, spot.offset);
  else range.selectNodeContents(el);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Select the plain-text range [start, end) within a content element. */
export function setSelection(el, start, end) {
  const from = locate(el, start);
  const to = locate(el, end);
  if (!from || !to) return;
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Current non-empty selection as block-relative offsets.
 * @returns {{content:HTMLElement, id:string, start:number, end:number}|null}
 */
export function getSelectionRange(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const content = contentEl(range.startContainer);
  if (!content || !root.contains(content) || contentEl(range.endContainer) !== content) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(content);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { content, id: blockIdOf(content), start, end: start + range.toString().length };
}

/** Focus a block's content by id (after a re-render) and place the caret. */
export function focusBlock(root, id, offset = 0) {
  const wrapper = root.querySelector(`.sc-block[data-block-id="${id}"]`);
  if (!wrapper) return;
  const content = wrapper.querySelector('[data-role="content"]');
  if (!content) return;
  content.focus();
  setCaret(content, offset);
}

function caretRect() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const rects = sel.getRangeAt(0).cloneRange().getClientRects();
  if (rects.length) return rects[0];
  const el = contentEl(sel.getRangeAt(0).startContainer);
  return el ? el.getBoundingClientRect() : null;
}

/** True when the caret sits on the first visual line of `el`. */
export function onFirstLine(el) {
  const cr = caretRect();
  if (!cr) return true;
  return cr.top - el.getBoundingClientRect().top < cr.height;
}

/** True when the caret sits on the last visual line of `el`. */
export function onLastLine(el) {
  const cr = caretRect();
  if (!cr) return true;
  return el.getBoundingClientRect().bottom - cr.bottom < cr.height;
}
