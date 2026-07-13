// Markdown shortcuts: typing a marker at the start of a block auto-converts it.
// Fires the moment the block's text equals a marker (e.g. "# ", "- ", "[] "),
// which is right after the triggering space. Emits `shortcut:applied`.

import { getBlock } from './registry.js';
import { findBlock, insertAfter } from './model.js';
import { segmentsText, segmentsLength, sliceSegments } from './segments.js';
import { convertBlock, createBlock } from './block-ops.js';
import { contentEl, blockIdOf, focusBlock } from './caret.js';
import { renderEditable } from './editing.js';
import { EVENTS, emit } from './events.js';

// Exact-match markers (block text, with the trailing space, equals `match`).
const MARKERS = [
  { match: '# ', type: 'heading-1' },
  { match: '## ', type: 'heading-2' },
  { match: '### ', type: 'heading-3' },
  { match: '- ', type: 'bulleted-list' },
  { match: '* ', type: 'bulleted-list' },
  { match: '1. ', type: 'numbered-list' },
  { match: '[] ', type: 'checklist' },
  { match: '[ ] ', type: 'checklist' },
  { match: '> ', type: 'quote' },
  { match: '```', type: 'code' },
  { match: '---', type: 'divider' },
];

export function initShortcuts(state, root) {
  const rerender = () => renderEditable(state, root);

  root.addEventListener('input', (event) => {
    const content = contentEl(event.target);
    if (!content) return;
    const id = blockIdOf(content);
    const loc = findBlock(state.doc.blocks, id);
    if (!loc) return;

    // Trailing spaces in contenteditable often arrive as non-breaking spaces.
    const text = segmentsText(loc.block.data.segments).replace(/ /g, ' ');
    const marker = MARKERS.find((m) => m.match === text);
    if (!marker) return;

    const def = getBlock(marker.type);
    if (!def) return; // e.g. code block not registered until Phase 7
    if (loc.block.type === marker.type) return;
    // Respect the page config: only markers for enabled blocks fire.
    if (state.config && state.config.blocks && !state.config.blocks.includes(marker.type)) return;

    const remaining = sliceSegments(
      loc.block.data.segments,
      marker.match.length,
      segmentsLength(loc.block.data.segments),
    );

    if (!def.editableText) {
      // Divider (and future non-text markers): become the block, add a
      // paragraph after so the caret has somewhere to land.
      convertBlock(loc.block, marker.type);
      const para = createBlock('paragraph', remaining);
      insertAfter(state.doc.blocks, id, para);
      rerender();
      focusBlock(root, para.id, 0);
      emit(root, EVENTS.SHORTCUT_APPLIED, { id, marker: marker.match, to: marker.type });
      emit(root, EVENTS.BLOCK_CONVERTED, { id, to: marker.type });
      emit(root, EVENTS.BLOCK_CREATED, { id: para.id, after: id });
      return;
    }

    loc.block.data.segments = remaining;
    convertBlock(loc.block, marker.type);
    rerender();
    focusBlock(root, id, 0);
    emit(root, EVENTS.SHORTCUT_APPLIED, { id, marker: marker.match, to: marker.type });
    emit(root, EVENTS.BLOCK_CONVERTED, { id, to: marker.type });
  });
}
