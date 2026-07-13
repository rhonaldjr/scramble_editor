// Text blocks: paragraph, headings, quote. All share the "text" Turn Into group
// and store rich text in data.segments.

import { createSegment, normalizeSegments } from '../segments.js';
import { inlineHost } from '../render.js';

/** Normalize incoming data into { segments } for a text block. */
export function textData(data = {}) {
  const segments = data.segments ? normalizeSegments(data.segments) : [createSegment(data.text || '')];
  return { segments };
}

function makeTextBlock({ type, label, icon, tag, className, continuationType, mdPrefix }) {
  return {
    type,
    label,
    icon,
    turnIntoGroup: 'text',
    editableText: true,
    // Type of the block produced when Enter splits this one (headings/quote
    // continue as paragraphs; paragraphs continue as paragraphs).
    continuationType: continuationType || type,
    create: (data) => textData(data),
    renderView: (block) => inlineHost(tag, block, className),
    renderEdit: (block) => inlineHost(tag, block, className),
    toMarkdown: (block, h) => `${mdPrefix || ''}${h.renderSegments(block.data.segments)}`,
    toHTML: (block, h) => `<${tag}>${h.renderSegments(block.data.segments)}</${tag}>`,
  };
}

export const paragraph = makeTextBlock({
  type: 'paragraph', label: 'Text', icon: '¶', tag: 'p', className: 'sc-paragraph', mdPrefix: '',
});
export const heading1 = makeTextBlock({
  type: 'heading-1', label: 'Heading 1', icon: 'H1', tag: 'h1', className: 'sc-h1',
  continuationType: 'paragraph', mdPrefix: '# ',
});
export const heading2 = makeTextBlock({
  type: 'heading-2', label: 'Heading 2', icon: 'H2', tag: 'h2', className: 'sc-h2',
  continuationType: 'paragraph', mdPrefix: '## ',
});
export const heading3 = makeTextBlock({
  type: 'heading-3', label: 'Heading 3', icon: 'H3', tag: 'h3', className: 'sc-h3',
  continuationType: 'paragraph', mdPrefix: '### ',
});
export const quote = makeTextBlock({
  type: 'quote', label: 'Quote', icon: '❝', tag: 'blockquote', className: 'sc-quote',
  continuationType: 'paragraph', mdPrefix: '> ',
});
