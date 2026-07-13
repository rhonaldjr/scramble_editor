// Document exporters. Walk the block tree and call each block's toMarkdown /
// toHTML with helpers, so blocks own their own export logic (registry
// contract). Pure string building — no DOM — reuses the client block modules.

import { getBlock } from '../public/editor/registry.js';
import { registerBuiltins } from '../public/editor/blocks/index.js';
import { segmentsToMarkdown, segmentsToHTML } from '../public/editor/segments.js';

registerBuiltins();

function indentLines(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}

function blocksToMarkdown(blocks) {
  const parts = [];
  for (const block of blocks) {
    const def = getBlock(block.type);
    if (!def || !def.toMarkdown) continue;
    const helpers = {
      renderSegments: segmentsToMarkdown,
      renderChildren: (b) => indentLines(blocksToMarkdown(b.children || []), 2),
    };
    parts.push({ text: def.toMarkdown(block, helpers), list: Boolean(def.listMarker) });
  }
  // List items in a run are separated by a single newline; everything else by
  // a blank line.
  return parts
    .map((p, i) => (i === 0 ? '' : p.list && parts[i - 1].list ? '\n' : '\n\n') + p.text)
    .join('');
}

function blockHTML(block) {
  const def = getBlock(block.type);
  if (!def || !def.toHTML) return '';
  const helpers = {
    renderSegments: segmentsToHTML,
    renderChildren: (b) => blocksToHTML(b.children || []),
  };
  return def.toHTML(block, helpers);
}

function blocksToHTML(blocks) {
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
        group += blockHTML(blocks[i]);
        i += 1;
      }
      html += `<${tag}${cls}>${group}</${tag}>`;
    } else {
      html += blockHTML(blocks[i]);
      i += 1;
    }
  }
  return html;
}

/** Export a document to a Markdown string. */
export function toMarkdown(doc) {
  return `${blocksToMarkdown(doc.blocks || []).trim()}\n`;
}

/** Export a document's body to an HTML fragment (no page chrome). */
export function toHTML(doc) {
  return blocksToHTML(doc.blocks || []);
}

function escapeHTML(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Export a document to a standalone HTML page. */
export function toHTMLDocument(doc) {
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    `<title>${escapeHTML(doc.title || 'Untitled')}</title>\n` +
    '</head>\n<body>\n' +
    `${toHTML(doc)}\n` +
    '</body>\n</html>\n'
  );
}
