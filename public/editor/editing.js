// Phase 2 live editing: contenteditable sync, keyboard behavior, drag reorder.
// Structural changes go through the pure model ops, then re-render + restore the
// caret. Plain typing mutates the DOM in place and mirrors back to segments
// without a re-render (so the caret is never disturbed).

import { getBlock } from './registry.js';
import { normalizeSegments, splitSegmentsAt, segmentsLength } from './segments.js';
import {
  findBlock,
  insertAfter,
  removeBlock,
  moveBlock,
  indentBlock,
  outdentBlock,
  previousBlock,
  nextBlock,
  mergeInto,
} from './model.js';
import { renderDocument } from './render.js';
import { EVENTS, emit } from './events.js';
import { createBlock } from './block-ops.js';
import {
  contentEl,
  blockIdOf,
  caretOffset,
  caretIsCollapsed,
  focusBlock,
  onFirstLine,
  onLastLine,
} from './caret.js';

/** Re-render the document in edit mode. Shared by all interaction modules. */
export function renderEditable(state, root) {
  renderDocument(state.doc, root, { editable: true });
}

// --- DOM <-> segments -------------------------------------------------------

const TAG_MARKS = {
  STRONG: 'bold', B: 'bold', EM: 'italic', I: 'italic',
  U: 'underline', S: 'strikethrough', STRIKE: 'strikethrough', DEL: 'strikethrough',
  CODE: 'code',
};

/** Read a contenteditable content element back into normalized segments. */
export function domToSegments(root) {
  const segments = [];
  const walk = (node, marks, link) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        segments.push({ text: child.nodeValue, marks: [...marks], ...(link ? { link } : {}) });
      } else if (child.nodeType === 1) {
        const tag = child.tagName;
        const nextMarks = TAG_MARKS[tag] ? [...marks, TAG_MARKS[tag]] : marks;
        const nextLink = tag === 'A' ? child.getAttribute('href') || link : link;
        if (tag === 'BR') return;
        walk(child, nextMarks, nextLink);
      }
    });
  };
  walk(root, [], null);
  return normalizeSegments(segments);
}

// --- main wiring ------------------------------------------------------------

/**
 * Attach editing behavior to the editor root. `state` is `{ doc }`; structural
 * ops mutate `state.doc.blocks` in place then re-render.
 */
export function initEditing(state, root) {
  const rerender = () => renderDocument(state.doc, root, { editable: true });

  root.addEventListener('input', (event) => {
    const content = contentEl(event.target);
    if (!content) return;
    const id = blockIdOf(content);
    const loc = findBlock(state.doc.blocks, id);
    if (!loc) return;
    loc.block.data.segments = domToSegments(content);
    emit(root, EVENTS.BLOCK_UPDATED, { id });
  });

  root.addEventListener('change', (event) => {
    if (!event.target.matches('[data-role="checkbox"]')) return;
    const id = blockIdOf(event.target);
    const loc = findBlock(state.doc.blocks, id);
    if (!loc) return;
    loc.block.data.checked = event.target.checked;
    emit(root, EVENTS.BLOCK_UPDATED, { id });
  });

  root.addEventListener('keydown', (event) => {
    const content = contentEl(event.target);
    if (!content) return;
    const id = blockIdOf(content);

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleEnter(state, root, content, id, rerender);
    } else if (event.key === 'Backspace' && caretOffset(content) === 0 && caretIsCollapsed()) {
      if (handleBackspace(state, root, id, rerender)) event.preventDefault();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const op = event.shiftKey ? outdentBlock : indentBlock;
      if (op(state.doc.blocks, id)) {
        const offset = caretOffset(content);
        rerender();
        focusBlock(root, id, offset);
        emit(root, EVENTS.BLOCK_MOVED, { id });
      }
    } else if (event.key === 'ArrowUp' && onFirstLine(content)) {
      const prev = previousBlock(state.doc.blocks, id);
      if (prev && moveFocusTo(root, prev, 'end')) event.preventDefault();
    } else if (event.key === 'ArrowDown' && onLastLine(content)) {
      const next = nextBlock(state.doc.blocks, id);
      if (next && moveFocusTo(root, next, 'start')) event.preventDefault();
    }
  });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const content = contentEl(sel.getRangeAt(0).startContainer);
    if (!content || !root.contains(content)) return;
    emit(root, EVENTS.SELECTION_CHANGED, {
      id: blockIdOf(content),
      offset: caretOffset(content),
    });
  });

  // Clicking the blank area below the content adds a trailing paragraph (unless
  // the last block is already an empty text block — then just focus it).
  root.addEventListener('click', (event) => {
    if (event.target !== root && !event.target.classList.contains('sc-blocks')) return;
    const blocks = state.doc.blocks;
    const last = blocks[blocks.length - 1];
    if (last) {
      const wrapper = root.querySelector(`.sc-block[data-block-id="${last.id}"]`);
      if (wrapper && event.clientY < wrapper.getBoundingClientRect().bottom) return;
      const def = getBlock(last.type);
      if (def && def.editableText && segmentsLength(last.data.segments) === 0) {
        focusBlock(root, last.id, 0);
        return;
      }
    }
    const para = createBlock('paragraph');
    blocks.push(para);
    rerender();
    focusBlock(root, para.id, 0);
    emit(root, EVENTS.BLOCK_CREATED, { id: para.id });
  });

  initDragReorder(state, root, rerender);
}

function moveFocusTo(root, block, where) {
  const def = getBlock(block.type);
  if (!def || !def.editableText) return false;
  const offset = where === 'end' ? segmentsLength(block.data.segments) : 0;
  focusBlock(root, block.id, offset);
  return true;
}

function handleEnter(state, root, content, id, rerender) {
  const loc = findBlock(state.doc.blocks, id);
  if (!loc) return;
  const def = getBlock(loc.block.type);
  const offset = caretOffset(content);
  const [before, after] = splitSegmentsAt(loc.block.data.segments, offset);

  // Enter on an empty list item exits the list instead of adding another item.
  if (def.listMarker && segmentsLength(loc.block.data.segments) === 0) {
    loc.block.type = 'paragraph';
    loc.block.data = getBlock('paragraph').create({ segments: after });
    rerender();
    focusBlock(root, id, 0);
    emit(root, EVENTS.BLOCK_CONVERTED, { id, to: 'paragraph' });
    return;
  }

  loc.block.data.segments = before;
  const newBlock = createBlock(def.continuationType || loc.block.type, after);
  insertAfter(state.doc.blocks, id, newBlock);
  rerender();
  focusBlock(root, newBlock.id, 0);
  emit(root, EVENTS.BLOCK_UPDATED, { id });
  emit(root, EVENTS.BLOCK_CREATED, { id: newBlock.id, after: id });
}

function handleBackspace(state, root, id, rerender) {
  const loc = findBlock(state.doc.blocks, id);
  if (!loc) return false;
  const prev = previousBlock(state.doc.blocks, id);
  if (!prev) return false;
  const prevDef = getBlock(prev.type);

  if (prevDef && prevDef.editableText) {
    const offset = mergeInto(prev, loc.block);
    removeBlock(state.doc.blocks, id);
    rerender();
    focusBlock(root, prev.id, offset);
    emit(root, EVENTS.BLOCK_DELETED, { id });
    emit(root, EVENTS.BLOCK_UPDATED, { id: prev.id });
    return true;
  }

  // Previous block can't hold text (e.g. divider): remove it if we're empty.
  if (segmentsLength(loc.block.data.segments) === 0) {
    removeBlock(state.doc.blocks, prev.id);
    rerender();
    focusBlock(root, id, 0);
    emit(root, EVENTS.BLOCK_DELETED, { id: prev.id });
    return true;
  }
  return false;
}

// --- drag reorder with drop guide ------------------------------------------

function initDragReorder(state, root, rerender) {
  let draggedId = null;
  const guide = document.createElement('div');
  guide.className = 'sc-drop-guide';

  root.addEventListener('dragstart', (event) => {
    const handle = event.target.closest('.sc-block__handle');
    if (!handle) return;
    const wrapper = handle.closest('.sc-block');
    draggedId = wrapper.dataset.blockId;
    wrapper.classList.add('sc-block--dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedId);
  });

  root.addEventListener('dragover', (event) => {
    if (!draggedId) return;
    const wrapper = event.target.closest('.sc-block');
    if (!wrapper || wrapper.dataset.blockId === draggedId) {
      guide.remove();
      return;
    }
    event.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    guide.dataset.position = after ? 'after' : 'before';
    guide.dataset.targetId = wrapper.dataset.blockId;
    wrapper.parentNode.insertBefore(guide, after ? wrapper.nextSibling : wrapper);
  });

  root.addEventListener('drop', (event) => {
    if (!draggedId) return;
    event.preventDefault();
    const targetId = guide.dataset.targetId;
    const position = guide.dataset.position || 'before';
    if (targetId && moveBlock(state.doc.blocks, draggedId, targetId, position)) {
      const moved = draggedId;
      rerender();
      emit(root, EVENTS.BLOCK_MOVED, { id: moved, targetId, position });
    }
    cleanup();
  });

  root.addEventListener('dragend', cleanup);

  function cleanup() {
    guide.remove();
    const dragging = root.querySelector('.sc-block--dragging');
    if (dragging) dragging.classList.remove('sc-block--dragging');
    draggedId = null;
  }
}
