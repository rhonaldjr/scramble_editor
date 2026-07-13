// View/edit rendering. Turns block data into DOM. The DOM is a projection of
// the data, never the source of truth. Only touches `document` inside function
// bodies so the module still imports cleanly in Node.

import { getBlock } from './registry.js';
import { segmentsToHTML } from './segments.js';
import { TEXT_COLORS, BG_COLORS } from './colors.js';

/**
 * Content element for a text-bearing block: seeds inline HTML from segments.
 * Shared by renderView and renderEdit; the framework flips contenteditable on.
 */
export function inlineHost(tag, block, className) {
  const el = document.createElement(tag);
  el.className = className;
  el.innerHTML = segmentsToHTML(block.data.segments);
  return el;
}

function markerElement(def, block, number) {
  const marker = document.createElement('span');
  marker.className = 'sc-marker';
  if (def.listMarker === 'bullet') {
    marker.classList.add('sc-marker--bullet');
    marker.textContent = '•';
  } else if (def.listMarker === 'number') {
    marker.classList.add('sc-marker--number');
    marker.textContent = `${number}.`;
  } else if (def.listMarker === 'check') {
    marker.classList.add('sc-marker--check');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = Boolean(block.data.checked);
    box.dataset.role = 'checkbox';
    marker.appendChild(box);
  }
  return marker;
}

/**
 * Render one block (and its children) to a wrapper element.
 * @param {object} block
 * @param {{editable?:boolean}} ctx
 * @param {number} number running index for numbered-list markers
 */
export function renderBlock(block, ctx = {}, number = 0) {
  const def = getBlock(block.type);
  const wrapper = document.createElement('div');
  wrapper.className = 'sc-block';
  wrapper.dataset.blockId = block.id;
  wrapper.dataset.type = block.type;

  const handle = document.createElement('div');
  handle.className = 'sc-block__handle';
  handle.setAttribute('draggable', 'true');
  handle.setAttribute('title', 'Drag to move');
  handle.textContent = '⠇';
  wrapper.appendChild(handle);

  const row = document.createElement('div');
  row.className = 'sc-block__row';

  if (!def) {
    row.textContent = `[unknown block: ${block.type}]`;
    wrapper.appendChild(row);
    return wrapper;
  }

  if (def.listMarker) row.appendChild(markerElement(def, block, number));

  const content =
    ctx.editable && def.renderEdit ? def.renderEdit(block, ctx) : def.renderView(block);
  content.classList.add('sc-block__content');
  if (ctx.editable && def.editableText) {
    content.setAttribute('contenteditable', 'true');
    content.dataset.role = 'content';
  }
  row.appendChild(content);

  // Presentation props (Phase 4): text + background color tokens.
  const props = block.props || {};
  const textColor = TEXT_COLORS[props.color];
  if (textColor) content.style.color = textColor;
  const bgColor = BG_COLORS[props.background];
  if (bgColor) {
    row.style.background = bgColor;
    row.classList.add('sc-block__row--filled');
  }

  wrapper.appendChild(row);

  if (block.children && block.children.length) {
    wrapper.appendChild(renderBlockList(block.children, ctx, 'sc-block__children'));
  }
  return wrapper;
}

/**
 * Render an ordered list of blocks, tracking the running counter used for
 * numbered-list markers (reset by any non-numbered block).
 */
export function renderBlockList(blocks, ctx = {}, className = 'sc-blocks') {
  const container = document.createElement('div');
  container.className = className;
  let counter = 0;
  for (const block of blocks) {
    const def = getBlock(block.type);
    if (def && def.listMarker === 'number') counter += 1;
    else counter = 0;
    container.appendChild(renderBlock(block, ctx, counter));
  }
  return container;
}

/** Render a whole document into `root`, replacing its contents. */
export function renderDocument(doc, root, ctx = {}) {
  root.innerHTML = '';
  root.classList.add('sc-editor');
  root.appendChild(renderBlockList(doc.blocks, ctx));
}
