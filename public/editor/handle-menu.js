// Handle menu: click a block's drag handle for block actions — Turn Into,
// Duplicate, Delete, Move up/down, Copy block link, Text color, Background
// color. Rendered as swappable panels (main / turn-into / color) in one popup.

import { getBlock } from './registry.js';
import { findBlock, removeBlock, insertAfter, moveUp, moveDown, previousBlock, nextBlock } from './model.js';
import { duplicateBlock } from './block-ops.js';
import { turnInto, turnIntoTargets } from './turn-into.js';
import { COLOR_TOKENS, TEXT_COLORS, BG_COLORS } from './colors.js';
import { renderEditable } from './editing.js';
import { focusBlock } from './caret.js';
import { EVENTS, emit } from './events.js';

export function initHandleMenu(state, root) {
  const menu = document.createElement('div');
  menu.className = 'sc-menu';
  menu.hidden = true;
  document.body.appendChild(menu);

  let currentId = null;
  const rerender = () => renderEditable(state, root);

  function close() {
    menu.hidden = true;
    menu.innerHTML = '';
    currentId = null;
  }

  function item(label, onClick, opts = {}) {
    const el = document.createElement('div');
    el.className = 'sc-menu-item' + (opts.danger ? ' sc-menu-item--danger' : '');
    el.innerHTML = `<span>${label}</span>${opts.arrow ? '<span class="sc-menu-arrow">›</span>' : ''}`;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onClick();
    });
    return el;
  }

  function showMainPanel() {
    const loc = findBlock(state.doc.blocks, currentId);
    if (!loc) return close();
    const block = loc.block;
    menu.innerHTML = '';

    if (turnIntoTargets(block.type).length > 1) {
      menu.appendChild(item('Turn into', showTurnIntoPanel, { arrow: true }));
    }
    menu.appendChild(item('Duplicate', () => doDuplicate(block)));
    menu.appendChild(item('Move up', () => doMove(moveUp)));
    menu.appendChild(item('Move down', () => doMove(moveDown)));
    menu.appendChild(item('Copy block link', () => doCopyLink(block)));
    menu.appendChild(item('Text color', () => showColorPanel('color'), { arrow: true }));
    menu.appendChild(item('Background color', () => showColorPanel('background'), { arrow: true }));
    menu.appendChild(item('Delete', () => doDelete(block), { danger: true }));
  }

  function showTurnIntoPanel() {
    const loc = findBlock(state.doc.blocks, currentId);
    if (!loc) return close();
    menu.innerHTML = '';
    menu.appendChild(item('‹ Back', showMainPanel));
    turnIntoTargets(loc.block.type).forEach((def) => {
      const label = def.type === loc.block.type ? `${def.label} ✓` : def.label;
      menu.appendChild(
        item(`<span class="sc-menu-icon">${def.icon || ''}</span>${label}`, () => doTurnInto(def.type)),
      );
    });
  }

  function showColorPanel(kind) {
    const loc = findBlock(state.doc.blocks, currentId);
    if (!loc) return close();
    const current = (loc.block.props || {})[kind] || 'default';
    const swatches = kind === 'color' ? TEXT_COLORS : BG_COLORS;
    menu.innerHTML = '';
    menu.appendChild(item('‹ Back', showMainPanel));
    COLOR_TOKENS.forEach((token) => {
      const chip = document.createElement('span');
      chip.className = 'sc-swatch';
      if (kind === 'color') {
        chip.style.color = swatches[token] || 'inherit';
        chip.textContent = 'A';
      } else {
        chip.style.background = swatches[token] || 'transparent';
        chip.textContent = '';
      }
      const label = token[0].toUpperCase() + token.slice(1) + (token === current ? ' ✓' : '');
      const row = item(`${chip.outerHTML}${label}`, () => doColor(kind, token));
      menu.appendChild(row);
    });
  }

  // --- actions ---
  function doTurnInto(type) {
    const loc = findBlock(state.doc.blocks, currentId);
    if (loc && turnInto(loc.block, type)) {
      const id = currentId;
      rerender();
      focusBlock(root, id, 0);
      emit(root, EVENTS.BLOCK_CONVERTED, { id, to: type });
    }
    close();
  }

  function doDuplicate(block) {
    const copy = duplicateBlock(block);
    insertAfter(state.doc.blocks, block.id, copy);
    rerender();
    focusBlock(root, copy.id, 0);
    emit(root, EVENTS.BLOCK_DUPLICATED, { id: copy.id, from: block.id });
    close();
  }

  function doMove(op) {
    if (op(state.doc.blocks, currentId)) {
      const id = currentId;
      rerender();
      focusBlock(root, id, 0);
      emit(root, EVENTS.BLOCK_MOVED, { id });
    }
    close();
  }

  function doDelete(block) {
    const neighbor = previousBlock(state.doc.blocks, block.id) || nextBlock(state.doc.blocks, block.id);
    removeBlock(state.doc.blocks, block.id);
    rerender();
    if (neighbor) focusBlock(root, neighbor.id, 0);
    emit(root, EVENTS.BLOCK_DELETED, { id: block.id });
    close();
  }

  function doCopyLink(block) {
    const url = `${location.origin}${location.pathname}#${block.id}`;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    close();
  }

  function doColor(kind, token) {
    const loc = findBlock(state.doc.blocks, currentId);
    if (loc) {
      loc.block.props = loc.block.props || {};
      loc.block.props[kind] = token === 'default' ? null : token;
      const id = currentId;
      rerender();
      focusBlock(root, id, 0);
      emit(root, EVENTS.BLOCK_UPDATED, { id });
    }
    close();
  }

  // --- open / dismiss ---
  root.addEventListener('click', (event) => {
    const handle = event.target.closest('.sc-block__handle');
    if (!handle) return;
    event.preventDefault();
    const wrapper = handle.closest('.sc-block');
    currentId = wrapper.dataset.blockId;
    const rect = handle.getBoundingClientRect();
    menu.hidden = false;
    showMainPanel();
    menu.style.left = `${Math.round(rect.right + 4)}px`;
    menu.style.top = `${Math.round(rect.top + window.scrollY)}px`;
  });

  document.addEventListener('mousedown', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !event.target.closest('.sc-block__handle')) {
      close();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) close();
  });
}
