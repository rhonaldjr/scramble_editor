// Bridges a contenteditable element with a block's reactive segments. Vue owns
// the data; we imperatively paint HTML and read the DOM back on input (so the
// caret is never disturbed by re-renders).
import { ref, watch, onMounted, nextTick } from 'vue';
import { segmentsToHTML, normalizeSegments, segmentsLength } from '../core/segments.js';

const TAG_MARKS = {
  STRONG: 'bold', B: 'bold', EM: 'italic', I: 'italic',
  U: 'underline', S: 'strikethrough', STRIKE: 'strikethrough', DEL: 'strikethrough', CODE: 'code',
};

export function domToSegments(root) {
  const segments = [];
  const walk = (node, marks, link) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        segments.push({ text: child.nodeValue, marks: [...marks], ...(link ? { link } : {}) });
      } else if (child.nodeType === 1) {
        const tag = child.tagName;
        if (tag === 'BR') return;
        const nextMarks = TAG_MARKS[tag] ? [...marks, TAG_MARKS[tag]] : marks;
        const nextLink = tag === 'A' ? child.getAttribute('href') || link : link;
        walk(child, nextMarks, nextLink);
      }
    });
  };
  walk(root, [], null);
  return normalizeSegments(segments);
}

export function caretOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

export function setCaret(el, offset) {
  const sel = window.getSelection();
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let remaining = offset;
  let last = null;
  let node = walker.nextNode();
  while (node) {
    last = node;
    if (node.nodeValue.length >= remaining) {
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= node.nodeValue.length;
    node = walker.nextNode();
  }
  if (last) range.setStart(last, last.nodeValue.length);
  else range.selectNodeContents(el);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function collapsed() {
  const sel = window.getSelection();
  return !sel || sel.isCollapsed;
}

export function useEditableText(block, ctx) {
  const el = ref(null);
  let internal = false;

  const paint = () => {
    if (el.value) el.value.innerHTML = segmentsToHTML(block.data.segments);
  };

  // Focus + caret for a pending request that targets this block.
  function applyFocus(req) {
    if (req && req.id === block.id && el.value) {
      nextTick(() => {
        if (!el.value) return;
        el.value.focus();
        setCaret(el.value, req.offset || 0);
        ctx.clearFocus();
      });
    }
  }

  onMounted(() => {
    paint();
    // A structural op (Enter split, slash insert) may have requested focus for
    // this block *before* it mounted — the watch below won't fire for that, so
    // consume the pending request here.
    applyFocus(ctx.focusRequest.value);
  });

  // Repaint only when segments change from outside our own typing.
  watch(
    () => block.data.segments,
    () => {
      if (internal) { internal = false; return; }
      paint();
    },
    { deep: true },
  );

  // Honor focus requests raised while this block is already mounted
  // (Backspace merge, arrow navigation, etc.).
  watch(() => ctx.focusRequest.value, applyFocus);

  function onInput() {
    internal = true;
    block.data.segments = domToSegments(el.value);
    ctx.emitEvent('block:updated', { id: block.id });
    ctx.markChanged();
  }

  function onKeydown(event) {
    if (ctx.readonly.value) return;
    const offset = caretOffset(el.value);
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ctx.splitBlock(block.id, offset);
    } else if (event.key === 'Backspace' && offset === 0 && collapsed()) {
      if (ctx.mergeWithPrevious(block.id)) event.preventDefault();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) ctx.outdent(block.id);
      else ctx.indent(block.id);
    } else if (event.key === 'ArrowUp' && offset === 0) {
      if (ctx.focusPrevious(block.id)) event.preventDefault();
    } else if (event.key === 'ArrowDown' && offset === segmentsLength(block.data.segments)) {
      if (ctx.focusNext(block.id)) event.preventDefault();
    }
  }

  return { el, onInput, onKeydown };
}
