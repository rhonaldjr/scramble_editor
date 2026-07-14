// Markdown / HTML exporters. Walk the block tree, calling each block's
// toMarkdown / toHTML with helpers. Pure — used by getMarkdown()/getHTML().

import { getBlock } from './registry.js';
import { segmentsToMarkdown, segmentsToHTML } from './segments.js';

function indentLines(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((l) => (l ? pad + l : l)).join('\n');
}

function blocksToMarkdown(blocks, doc) {
  const parts = [];
  for (const block of blocks) {
    const def = getBlock(block.type);
    if (!def || !def.toMarkdown) continue;
    const helpers = {
      doc,
      renderSegments: segmentsToMarkdown,
      renderChildren: (b) => indentLines(blocksToMarkdown(b.children || [], doc), 2),
      renderChildrenRaw: (b) => blocksToMarkdown(b.children || [], doc),
    };
    parts.push({ text: def.toMarkdown(block, helpers), list: Boolean(def.listMarker) });
  }
  return parts
    .map((p, i) => (i === 0 ? '' : p.list && parts[i - 1].list ? '\n' : '\n\n') + p.text)
    .join('');
}

function blockHTML(block, doc) {
  const def = getBlock(block.type);
  if (!def || !def.toHTML) return '';
  const helpers = {
    doc,
    renderSegments: segmentsToHTML,
    renderChildren: (b) => blocksToHTML(b.children || [], doc),
    renderChildrenRaw: (b) => blocksToHTML(b.children || [], doc),
  };
  return def.toHTML(block, helpers);
}

function blocksToHTML(blocks, doc) {
  let html = '';
  let i = 0;
  while (i < blocks.length) {
    const def = getBlock(blocks[i].type);
    if (def && def.listMarker) {
      const marker = def.listMarker;
      const tag = marker === 'number' ? 'ol' : 'ul';
      const cls = marker === 'check' ? ' class="sc-checklist"' : '';
      let group = '';
      while (i < blocks.length) {
        const d = getBlock(blocks[i].type);
        if (!d || d.listMarker !== marker) break;
        group += blockHTML(blocks[i], doc);
        i += 1;
      }
      html += `<${tag}${cls}>${group}</${tag}>`;
    } else {
      html += blockHTML(blocks[i], doc);
      i += 1;
    }
  }
  return html;
}

export function toMarkdown(doc) {
  return `${blocksToMarkdown(doc.blocks || [], doc).trim()}\n`;
}

export function toHTML(doc) {
  return blocksToHTML(doc.blocks || [], doc);
}
