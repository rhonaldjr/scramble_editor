// Inline formatting toolbar: appears over a text selection with bold, italic,
// underline, strikethrough, inline code, and link. Formatting is stored as
// marks in the segment data, never as raw HTML.

import { findBlock } from './model.js';
import { toggleMark, setLinkOnRange, rangeHasMark } from './segments.js';
import { getSelectionRange, setSelection, blockIdOf } from './caret.js';
import { renderEditable } from './editing.js';
import { EVENTS, emit } from './events.js';

const TOOLS = [
  { mark: 'bold', label: 'B', title: 'Bold', className: 'sc-tool--bold' },
  { mark: 'italic', label: 'i', title: 'Italic', className: 'sc-tool--italic' },
  { mark: 'underline', label: 'U', title: 'Underline', className: 'sc-tool--underline' },
  { mark: 'strikethrough', label: 'S', title: 'Strikethrough', className: 'sc-tool--strike' },
  { mark: 'code', label: '<>', title: 'Inline code', className: 'sc-tool--code' },
  { mark: 'link', label: '🔗', title: 'Link', className: 'sc-tool--link' },
];

export function initToolbar(state, root) {
  const bar = document.createElement('div');
  bar.className = 'sc-toolbar';
  bar.hidden = true;

  const allowed = state.config && state.config.toolbar ? new Set(state.config.toolbar) : null;
  const tools = allowed ? TOOLS.filter((t) => allowed.has(t.mark)) : TOOLS;
  if (tools.length === 0) return; // config disables the toolbar entirely

  tools.forEach((tool) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sc-tool ${tool.className}`;
    btn.title = tool.title;
    btn.textContent = tool.label;
    // mousedown (not click) so the selection isn't lost before we act.
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      apply(tool.mark);
    });
    bar.appendChild(btn);
  });
  document.body.appendChild(bar);

  function hide() {
    bar.hidden = true;
  }

  function showFor(sel) {
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    bar.hidden = false;
    // Reflect active marks on the current selection.
    tools.forEach((tool, i) => {
      const active = rangeHasMark(
        findBlock(state.doc.blocks, sel.id).block.data.segments,
        sel.start,
        sel.end,
        tool.mark,
      );
      bar.children[i].classList.toggle('sc-tool--active', active);
    });
    const barRect = bar.getBoundingClientRect();
    const left = Math.max(8, rect.left + rect.width / 2 - barRect.width / 2);
    bar.style.left = `${Math.round(left)}px`;
    bar.style.top = `${Math.round(rect.top - barRect.height - 6 + window.scrollY)}px`;
  }

  function apply(mark) {
    const sel = getSelectionRange(root);
    if (!sel) return;
    const loc = findBlock(state.doc.blocks, sel.id);
    if (!loc) return;

    if (mark === 'link') {
      const has = rangeHasMark(loc.block.data.segments, sel.start, sel.end, 'link');
      const href = has ? '' : window.prompt('Link URL');
      if (href === null) return; // cancelled
      loc.block.data.segments = setLinkOnRange(loc.block.data.segments, sel.start, sel.end, href);
    } else {
      loc.block.data.segments = toggleMark(loc.block.data.segments, sel.start, sel.end, mark);
    }

    renderEditable(state, root);
    // Restore the selection so consecutive formatting works.
    const wrapper = root.querySelector(`.sc-block[data-block-id="${sel.id}"] [data-role="content"]`);
    if (wrapper) {
      wrapper.focus();
      setSelection(wrapper, sel.start, sel.end);
    }
    emit(root, EVENTS.BLOCK_UPDATED, { id: sel.id });
  }

  document.addEventListener('selectionchange', () => {
    const sel = getSelectionRange(root);
    if (sel && sel.start !== sel.end) showFor(sel);
    else hide();
  });

  root.addEventListener('scroll', hide, true);
}
