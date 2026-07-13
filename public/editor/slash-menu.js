// Slash menu: type "/" to open a filterable block picker at the caret. Arrow
// keys navigate, Enter/click selects, Esc closes. Selecting an empty block
// converts it; selecting from a non-empty block inserts a new block after.

import { listBlocks, getBlock } from './registry.js';
import { findBlock, insertAfter } from './model.js';
import {
  segmentsText,
  segmentsLength,
  sliceSegments,
  concatSegments,
  isEmptySegments,
} from './segments.js';
import { createBlock, convertBlock } from './block-ops.js';
import { contentEl, blockIdOf, caretOffset, focusBlock } from './caret.js';
import { renderEditable } from './editing.js';
import { EVENTS, emit } from './events.js';

export function initSlashMenu(state, root) {
  const menu = document.createElement('div');
  menu.className = 'sc-slash-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  document.body.appendChild(menu);

  let open = false;
  let blockId = null;
  let slashOffset = 0;
  let items = [];
  let active = 0;

  const rerender = () => renderEditable(state, root);

  function close() {
    open = false;
    blockId = null;
    menu.hidden = true;
    menu.innerHTML = '';
  }

  function positionAtCaret() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 4)}px`;
  }

  function renderItems() {
    menu.innerHTML = '';
    items.forEach((def, i) => {
      const item = document.createElement('div');
      item.className = 'sc-slash-item' + (i === active ? ' sc-slash-item--active' : '');
      item.dataset.type = def.type;
      item.innerHTML =
        `<span class="sc-slash-icon">${def.icon || ''}</span>` +
        `<span class="sc-slash-label">${def.label}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        select(def.type);
      });
      menu.appendChild(item);
    });
    menu.hidden = items.length === 0;
  }

  function refresh() {
    const loc = findBlock(state.doc.blocks, blockId);
    if (!loc) return close();
    const text = segmentsText(loc.block.data.segments);
    const caret = caretOffset(document.querySelector(`.sc-block[data-block-id="${blockId}"] [data-role="content"]`));
    if (caret <= slashOffset || text[slashOffset] !== '/') return close();
    const query = text.slice(slashOffset + 1, caret);
    if (/\s/.test(query)) return close();
    const q = query.toLowerCase();
    const allowed = state.config && state.config.blocks ? new Set(state.config.blocks) : null;
    items = listBlocks().filter(
      (def) =>
        (!allowed || allowed.has(def.type)) &&
        (def.label.toLowerCase().includes(q) || def.type.includes(q)),
    );
    active = 0;
    renderItems();
    positionAtCaret();
  }

  function select(type) {
    const loc = findBlock(state.doc.blocks, blockId);
    if (!loc) return close();
    const segs = loc.block.data.segments;
    const len = segmentsLength(segs);
    const content = document.querySelector(
      `.sc-block[data-block-id="${blockId}"] [data-role="content"]`,
    );
    const caret = content ? caretOffset(content) : len;
    // Strip "/query" (from the slash up to the caret) out of the block.
    const remaining = concatSegments(
      sliceSegments(segs, 0, slashOffset),
      sliceSegments(segs, Math.min(caret, len), len),
    );
    loc.block.data.segments = remaining;
    const def = getBlock(type);
    const targetId = blockId;

    if (isEmptySegments(remaining)) {
      if (def.editableText) {
        convertBlock(loc.block, type);
        rerender();
        focusBlock(root, targetId, 0);
        emit(root, EVENTS.BLOCK_CONVERTED, { id: targetId, to: type });
      } else {
        convertBlock(loc.block, type);
        const para = createBlock('paragraph');
        insertAfter(state.doc.blocks, targetId, para);
        rerender();
        focusBlock(root, para.id, 0);
        emit(root, EVENTS.BLOCK_CONVERTED, { id: targetId, to: type });
        emit(root, EVENTS.BLOCK_CREATED, { id: para.id, after: targetId });
      }
    } else {
      const block = createBlock(type);
      insertAfter(state.doc.blocks, targetId, block);
      let focusId = block.id;
      if (!def.editableText) {
        const para = createBlock('paragraph');
        insertAfter(state.doc.blocks, block.id, para);
        focusId = para.id;
        emit(root, EVENTS.BLOCK_CREATED, { id: para.id, after: block.id });
      }
      rerender();
      focusBlock(root, focusId, 0);
      emit(root, EVENTS.BLOCK_CREATED, { id: block.id, after: targetId });
    }
    emit(root, EVENTS.SLASH_SELECTED, { type });
    close();
  }

  root.addEventListener('input', (event) => {
    const content = contentEl(event.target);
    if (!content) {
      if (open) close();
      return;
    }
    const id = blockIdOf(content);
    const caret = caretOffset(content);
    const loc = findBlock(state.doc.blocks, id);
    if (!loc) return;
    const text = segmentsText(loc.block.data.segments);

    if (!open) {
      const prevChar = text[caret - 1];
      const beforeSlash = text[caret - 2];
      if (prevChar === '/' && (caret - 1 === 0 || /\s/.test(beforeSlash))) {
        open = true;
        blockId = id;
        slashOffset = caret - 1;
        emit(root, EVENTS.SLASH_OPENED, { id });
        refresh();
      }
    } else if (id === blockId) {
      refresh();
    } else {
      close();
    }
  });

  // Capture phase so menu navigation wins over the editing keydown handler.
  root.addEventListener(
    'keydown',
    (event) => {
      if (!open) return;
      if (event.key === 'ArrowDown') {
        active = (active + 1) % Math.max(items.length, 1);
        renderItems();
        stop(event);
      } else if (event.key === 'ArrowUp') {
        active = (active - 1 + items.length) % Math.max(items.length, 1);
        renderItems();
        stop(event);
      } else if (event.key === 'Enter') {
        if (items[active]) select(items[active].type);
        stop(event);
      } else if (event.key === 'Escape') {
        close();
        stop(event);
      }
    },
    true,
  );

  root.addEventListener('blur', () => open && close(), true);

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
  }
}
