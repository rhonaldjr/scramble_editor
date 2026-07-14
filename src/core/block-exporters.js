// Framework-free export helpers for media/embed/bookmark/table/toc. Kept in core
// so they're unit-testable without Vue. blocks/index.js wires them to the
// registry; Vue components handle only rendering/editing.

import { segmentsToMarkdown, segmentsToHTML, segmentsText } from './segments.js';
import { flattenBlocks } from './model.js';
import { headingLevel } from './collapse.js';
import { youtubeId } from './embed.js';

export function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function escAttr(t) {
  return esc(t).replace(/"/g, '&quot;');
}

export function mediaMarkdown(b, kind) {
  const url = b.data.url || '';
  const cap = b.data.caption || '';
  if (!url) return '';
  if (kind === 'image') return `![${cap}](${url})`;
  const label = cap || (kind === 'file' ? url : kind[0].toUpperCase() + kind.slice(1));
  return `[${label}](${url})`;
}
export function mediaHTML(b, kind) {
  if (!b.data.url) return '';
  const url = escAttr(b.data.url);
  const cap = b.data.caption || '';
  const style = b.data.width ? ` style="width:${Number(b.data.width)}px"` : '';
  if (kind === 'image') {
    const fc = cap ? `<figcaption>${esc(cap)}</figcaption>` : '';
    const align = (b.props && b.props.align) || b.data.align || 'left';
    return `<figure class="sc-media--align-${align}"><img src="${url}" alt="${escAttr(cap)}"${style}>${fc}</figure>`;
  }
  if (kind === 'video') {
    const o = b.data.options || {};
    const attrs = [o.controls !== false ? 'controls' : '', o.autoplay ? 'autoplay' : '', o.loop ? 'loop' : '', o.muted ? 'muted' : '']
      .filter(Boolean).join(' ');
    return `<video src="${url}"${style} ${attrs}></video>`;
  }
  if (kind === 'audio') return `<audio src="${url}" controls></audio>`;
  return `<a href="${url}">${esc(cap || b.data.url)}</a>`;
}

export function embedMarkdown(b) {
  return b.data.url ? `[embed](${b.data.url})` : '';
}
export function embedHTML(b) {
  if (!b.data.url) return '';
  const id = youtubeId(b.data.url);
  const src = id ? `https://www.youtube.com/embed/${id}` : escAttr(b.data.url);
  const style = b.data.width ? ` style="width:${Number(b.data.width)}px;aspect-ratio:16/9"` : '';
  return `<iframe class="sc-embed__frame" src="${src}"${style} frameborder="0" allowfullscreen></iframe>`;
}

export function webpageMarkdown(b) {
  return b.data.url ? `[${b.data.url}](${b.data.url})` : '';
}
export function webpageHTML(b) {
  if (!b.data.url) return '';
  const w = b.data.width ? `${Number(b.data.width)}px` : '100%';
  const h = `${Number(b.data.height) || 480}px`;
  return `<iframe class="sc-webpage__frame" src="${escAttr(b.data.url)}" style="width:${w};height:${h};border:0" loading="lazy"></iframe>`;
}

function slideBgStyle(b) {
  const p = b.props || {};
  const parts = [];
  if (p.backgroundColor) parts.push(`background:${p.backgroundColor}`);
  if (p.backgroundImage) parts.push(`background-image:url('${escAttr(p.backgroundImage)}')`, 'background-size:cover', 'background-position:center');
  return parts.join(';');
}
export function slideMarkdown(b, h) {
  return h.renderChildrenRaw(b);
}
export function slideHTML(b, h) {
  const style = slideBgStyle(b);
  return `<section class="sc-slide"${style ? ` style="${style}"` : ''}>${h.renderChildrenRaw(b)}</section>`;
}
export function slidesMarkdown(b, h) {
  return (b.children || []).map((s) => h.renderChildrenRaw(s)).filter(Boolean).join('\n\n---\n\n');
}
export function slidesHTML(b, h) {
  return `<div class="sc-slides">${h.renderChildrenRaw(b)}</div>`;
}

export function documentMarkdown(b) {
  const url = b.data.url || '';
  return url ? `[${b.data.name || url}](${url})` : '';
}
export function documentHTML(b) {
  if (!b.data.url) return '';
  const w = b.data.width ? `${Number(b.data.width)}px` : '100%';
  const h = `${Number(b.data.height) || 480}px`;
  const src = escAttr(b.data.viewerUrl || b.data.url);
  return `<iframe class="sc-document__frame" src="${src}" style="width:${w};height:${h};border:0" loading="lazy"></iframe>`;
}

function buttonStyleAttr(b) {
  const parts = [];
  const { variant, textColor, bgColor } = b.data;
  if (variant === 'outline') {
    parts.push('background:transparent');
    if (bgColor) parts.push(`border-color:${bgColor}`, `color:${bgColor}`);
    if (textColor) parts.push(`color:${textColor}`);
  } else {
    if (bgColor) parts.push(`background:${bgColor}`);
    if (textColor) parts.push(`color:${textColor}`);
  }
  return parts.join(';');
}
export function buttonMarkdown(b) {
  const label = b.data.label || 'Button';
  return b.data.action === 'link' && b.data.url ? `[${label}](${b.data.url})` : `**${label}**`;
}
export function buttonHTML(b) {
  const label = esc(b.data.label || 'Button');
  const cls = `sc-button${b.data.variant === 'outline' ? ' sc-button--outline' : ''}`;
  const style = buttonStyleAttr(b);
  const styleAttr = style ? ` style="${style}"` : '';
  if (b.data.action === 'link' && b.data.url) {
    const tgt = b.data.target === '_blank' ? ' target="_blank" rel="noopener"' : '';
    return `<a class="${cls}" href="${escAttr(b.data.url)}"${tgt}${styleAttr}>${label}</a>`;
  }
  return `<button class="${cls}" type="button"${styleAttr}>${label}</button>`;
}

// Accordion is a group of accordion-item blocks (each a <details>).
export function accordionMarkdown(b, h) {
  return (b.children || []).map((item) => accordionItemMarkdown(item, h)).filter(Boolean).join('\n\n');
}
export function accordionHTML(b, h) {
  return `<div class="sc-accordion">${h.renderChildrenRaw(b)}</div>`;
}
export function accordionItemMarkdown(b, h) {
  const line = `**${h.renderSegments(b.data.segments)}**`;
  const kids = h.renderChildren(b);
  return kids ? `${line}\n${kids}` : line;
}
export function accordionItemHTML(b, h) {
  const open = b.props && b.props.collapsed ? '' : ' open';
  return `<details class="sc-accordion-item"${open}><summary>${h.renderSegments(b.data.segments)}</summary>${h.renderChildrenRaw(b)}</details>`;
}

export function bookmarkMarkdown(b) {
  if (!b.data.url) return '';
  return `[${(b.data.meta && b.data.meta.title) || b.data.url}](${b.data.url})`;
}
export function bookmarkHTML(b) {
  if (!b.data.url) return '';
  const m = b.data.meta || {};
  const desc = m.description ? `<div class="sc-bookmark__desc">${esc(m.description)}</div>` : '';
  return `<a class="sc-bookmark" href="${escAttr(b.data.url)}"><div class="sc-bookmark__title">${esc(m.title || b.data.url)}</div>${desc}<div class="sc-bookmark__host">${esc(b.data.url)}</div></a>`;
}

export function tableMarkdown(b) {
  const rows = b.data.rows || [];
  if (!rows.length) return '';
  const line = (row) => `| ${row.map((c) => segmentsToMarkdown(c)).join(' | ')} |`;
  const sep = `| ${rows[0].map(() => '---').join(' | ')} |`;
  return [line(rows[0]), sep, ...rows.slice(1).map(line)].join('\n');
}
export function tableHTML(b) {
  const rows = b.data.rows || [];
  const tag = (r) => (r === 0 ? 'th' : 'td');
  const body = rows.map((row, r) => `<tr>${row.map((c) => `<${tag(r)}>${segmentsToHTML(c)}</${tag(r)}>`).join('')}</tr>`).join('');
  return `<table class="sc-table">${body}</table>`;
}

function tocHeadings(doc) {
  return doc ? flattenBlocks(doc.blocks).filter((b) => headingLevel(b.type) > 0) : [];
}
export function pageLinkMarkdown(b) {
  return b.data.docId ? `[${b.data.title || b.data.docId}](?doc=${b.data.docId})` : '';
}
export function pageLinkHTML(b) {
  if (!b.data.docId) return '';
  return `<a class="sc-pagelink" href="?doc=${escAttr(b.data.docId)}">${esc(`📄 ${b.data.title || b.data.docId}`)}</a>`;
}

export function tocMarkdown(doc) {
  return tocHeadings(doc).map((h) => `${'  '.repeat(headingLevel(h.type) - 1)}- ${segmentsText(h.data.segments)}`).join('\n');
}
export function tocHTML(doc) {
  const items = tocHeadings(doc)
    .map((h) => `<li class="sc-toc__l${headingLevel(h.type)}"><a href="#${h.id}">${esc(segmentsText(h.data.segments))}</a></li>`)
    .join('');
  return `<nav class="sc-toc"><ul>${items}</ul></nav>`;
}
