// List blocks: bulleted, numbered, checklist. Each list item is its own block;
// nested items live in `children`. They share the "text" Turn Into group.

import { createSegment, normalizeSegments } from '../segments.js';
import { inlineHost } from '../render.js';

function listData(data = {}, withChecked) {
  const segments = data.segments ? normalizeSegments(data.segments) : [createSegment(data.text || '')];
  const out = { segments };
  if (withChecked) out.checked = Boolean(data.checked);
  return out;
}

function makeListBlock({ type, label, icon, className, listMarker }) {
  const withChecked = listMarker === 'check';
  return {
    type,
    label,
    icon,
    turnIntoGroup: 'text',
    editableText: true,
    listMarker,
    continuationType: type,
    create: (data) => listData(data, withChecked),
    renderView: (block) => inlineHost('div', block, className),
    renderEdit: (block) => inlineHost('div', block, className),
    toMarkdown: (block, h) => {
      const bullet =
        listMarker === 'number'
          ? '1. '
          : listMarker === 'check'
            ? `- [${block.data.checked ? 'x' : ' '}] `
            : '- ';
      const line = bullet + h.renderSegments(block.data.segments);
      const kids = h.renderChildren(block);
      return kids ? `${line}\n${kids}` : line;
    },
    toHTML: (block, h) => {
      const box =
        listMarker === 'check'
          ? `<input type="checkbox" disabled${block.data.checked ? ' checked' : ''}> `
          : '';
      return `<li>${box}${h.renderSegments(block.data.segments)}${h.renderChildren(block)}</li>`;
    },
  };
}

export const bulletedList = makeListBlock({
  type: 'bulleted-list', label: 'Bulleted list', icon: '•', className: 'sc-list-item', listMarker: 'bullet',
});
export const numberedList = makeListBlock({
  type: 'numbered-list', label: 'Numbered list', icon: '1.', className: 'sc-list-item', listMarker: 'number',
});
export const checklist = makeListBlock({
  type: 'checklist', label: 'To-do list', icon: '☑', className: 'sc-list-item', listMarker: 'check',
});
