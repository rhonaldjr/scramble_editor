// Registers the built-in blocks: type -> Vue component + metadata + exporters.
// Add more blocks by following this same shape (see README).
import TextBlock from './TextBlock.vue';
import ListItem from './ListItem.vue';
import Divider from './Divider.vue';
import CodeBlock from './CodeBlock.vue';
import Callout from './Callout.vue';
import MediaBlock from './MediaBlock.vue';
import EmbedBlock from './EmbedBlock.vue';
import BookmarkBlock from './BookmarkBlock.vue';
import WebPageBlock from './WebPageBlock.vue';
import DocumentBlock from './DocumentBlock.vue';
import SlideBlock from './SlideBlock.vue';
import SlidesBlock from './SlidesBlock.vue';
import ButtonBlock from './ButtonBlock.vue';
import AccordionBlock from './AccordionBlock.vue';
import AccordionItemBlock from './AccordionItemBlock.vue';
import TableBlock from './TableBlock.vue';
import TocBlock from './TocBlock.vue';
import Columns from './Columns.vue';
import Column from './Column.vue';
import PageLinkBlock from './PageLinkBlock.vue';
import { registerBlock, hasBlock } from '../core/registry.js';
import { createSegment, normalizeSegments } from '../core/segments.js';
import {
  esc, mediaMarkdown, mediaHTML, embedMarkdown, embedHTML, bookmarkMarkdown, bookmarkHTML,
  webpageMarkdown, webpageHTML, documentMarkdown, documentHTML,
  slideMarkdown, slideHTML, slidesMarkdown, slidesHTML,
  buttonMarkdown, buttonHTML, accordionMarkdown, accordionHTML, accordionItemMarkdown, accordionItemHTML,
  tableMarkdown, tableHTML, tocMarkdown, tocHTML, pageLinkMarkdown, pageLinkHTML,
} from '../core/block-exporters.js';

function textData(data = {}) {
  return {
    segments: data.segments ? normalizeSegments(data.segments) : [createSegment(data.text || '')],
  };
}

function text(type, label, icon, tag, cls, mdPrefix, continuationType) {
  return {
    type, label, icon, group: 'text', editableText: true,
    continuationType: continuationType || type,
    component: TextBlock, componentProps: { tag, cls },
    create: textData,
    toMarkdown: (b, h) => `${mdPrefix}${h.renderSegments(b.data.segments)}`,
    toHTML: (b, h) => `<${tag}>${h.renderSegments(b.data.segments)}</${tag}>`,
  };
}

function callout(type, label, icon, variant, defaultIcon, className) {
  return {
    type, label, icon, group: 'text', editableText: true, continuationType: 'paragraph',
    component: Callout, componentProps: { variant },
    create: (d = {}) => ({ segments: textData(d).segments, icon: d.icon || defaultIcon }),
    toMarkdown: (b, h) => {
      const line = `> ${b.data.icon || ''} ${h.renderSegments(b.data.segments)}`.trimEnd();
      const kids = h.renderChildren(b);
      return kids ? `${line}\n${kids}` : line;
    },
    toHTML: (b, h) =>
      `<div class="${className}"><span class="sc-callout__icon">${b.data.icon || ''}</span>` +
      `<div class="sc-callout__body">${h.renderSegments(b.data.segments)}${h.renderChildren(b)}</div></div>`,
  };
}

function list(type, label, icon, marker) {
  const withChecked = marker === 'check';
  return {
    type, label, icon, group: 'text', editableText: true, listMarker: marker,
    continuationType: type,
    component: ListItem, componentProps: { marker },
    create: (data = {}) => {
      const d = textData(data);
      if (withChecked) d.checked = Boolean(data.checked);
      return d;
    },
    toMarkdown: (b, h) => {
      const bullet = marker === 'number' ? '1. ' : marker === 'check' ? `- [${b.data.checked ? 'x' : ' '}] ` : '- ';
      const line = bullet + h.renderSegments(b.data.segments);
      const kids = h.renderChildren(b);
      return kids ? `${line}\n${kids}` : line;
    },
    toHTML: (b, h) => {
      const box = marker === 'check' ? `<input type="checkbox" disabled${b.data.checked ? ' checked' : ''}> ` : '';
      return `<li>${box}${h.renderSegments(b.data.segments)}${h.renderChildren(b)}</li>`;
    },
  };
}

// media (image / video / audio / file) — exporters live in core/block-exporters.
function media(type, label, icon, kind) {
  return {
    type, label, icon, group: null,
    component: MediaBlock, componentProps: { kind },
    create: (d = {}) => ({
      url: d.url || '', caption: d.caption || '', width: d.width || null,
      align: d.align || 'left', options: d.options || (kind === 'video' ? { controls: true } : {}),
    }),
    toMarkdown: (b) => mediaMarkdown(b, kind),
    toHTML: (b) => mediaHTML(b, kind),
  };
}

export function registerBuiltins() {
  if (hasBlock('paragraph')) return;
  registerBlock(text('paragraph', 'Text', '¶', 'p', 'sc-p', '', 'paragraph'));
  registerBlock(text('heading-1', 'Heading 1', 'H1', 'h1', 'sc-h1', '# ', 'paragraph'));
  registerBlock(text('heading-2', 'Heading 2', 'H2', 'h2', 'sc-h2', '## ', 'paragraph'));
  registerBlock(text('heading-3', 'Heading 3', 'H3', 'h3', 'sc-h3', '### ', 'paragraph'));
  registerBlock(text('quote', 'Quote', '❝', 'blockquote', 'sc-quote', '> ', 'paragraph'));
  registerBlock(list('bulleted-list', 'Bulleted list', '•', 'bullet'));
  registerBlock(list('numbered-list', 'Numbered list', '1.', 'number'));
  registerBlock(list('checklist', 'To-do list', '☑', 'check'));
  registerBlock({
    type: 'toggle', label: 'Toggle list', icon: '▸', group: 'text', editableText: true,
    collapsibleChildren: true, continuationType: 'paragraph',
    component: TextBlock, componentProps: { tag: 'div', cls: 'sc-toggle__title' },
    create: textData,
    toMarkdown: (b, h) => {
      const line = `- ${h.renderSegments(b.data.segments)}`;
      const kids = h.renderChildren(b);
      return kids ? `${line}\n${kids}` : line;
    },
    toHTML: (b, h) => {
      const open = b.props && b.props.collapsed ? '' : ' open';
      return `<details${open}><summary>${h.renderSegments(b.data.segments)}</summary>${h.renderChildren(b)}</details>`;
    },
  });
  registerBlock(callout('callout', 'Callout', '💡', 'callout', '💡', 'sc-callout'));
  registerBlock(callout('banner', 'Banner', '📢', 'banner', '📢', 'sc-banner'));
  registerBlock({
    type: 'divider', label: 'Divider', icon: '―', group: null, void: true,
    component: Divider, create: () => ({}),
    toMarkdown: () => '---', toHTML: () => '<hr>',
  });
  registerBlock({
    type: 'code', label: 'Code', icon: '{}', group: null,
    component: CodeBlock,
    create: (d = {}) => ({ code: d.code || '', language: d.language || '' }),
    toMarkdown: (b) => '```' + (b.data.language || '') + '\n' + (b.data.code || '') + '\n```',
    toHTML: (b) =>
      `<pre class="sc-code"><code${b.data.language ? ` class="language-${b.data.language}"` : ''}>${esc(b.data.code || '')}</code></pre>`,
  });

  // Media
  registerBlock(media('image', 'Image', '🖼', 'image'));
  registerBlock(media('video', 'Video', '🎬', 'video'));
  registerBlock(media('audio', 'Audio', '🔊', 'audio'));
  registerBlock(media('file', 'File', '📎', 'file'));

  // Embed + bookmark
  registerBlock({
    type: 'embed', label: 'Embed', icon: '🔗', group: null,
    component: EmbedBlock, create: (d = {}) => ({ url: d.url || '', width: d.width || null }),
    toMarkdown: embedMarkdown, toHTML: embedHTML,
  });
  registerBlock({
    type: 'bookmark', label: 'Bookmark', icon: '🔖', group: null,
    component: BookmarkBlock, create: (d = {}) => ({ url: d.url || '', meta: d.meta || null }),
    toMarkdown: bookmarkMarkdown, toHTML: bookmarkHTML,
  });
  registerBlock({
    type: 'webpage', label: 'Web page', icon: '🌐', group: null,
    component: WebPageBlock,
    create: (d = {}) => ({ url: d.url || '', width: d.width || null, height: d.height || 480 }),
    toMarkdown: webpageMarkdown, toHTML: webpageHTML,
  });
  registerBlock({
    type: 'document', label: 'Document', icon: '📑', group: null,
    component: DocumentBlock,
    create: (d = {}) => ({
      url: d.url || '', name: d.name || '', docType: d.docType || '',
      width: d.width || null, height: d.height || 480, viewerUrl: d.viewerUrl || '',
    }),
    toMarkdown: documentMarkdown, toHTML: documentHTML,
  });

  // Table + TOC
  registerBlock({
    type: 'table', label: 'Table', icon: '▦', group: null,
    component: TableBlock,
    create: (d = {}) => ({
      rows: d.rows && d.rows.length ? d.rows : [[[{ text: '', marks: [] }], [{ text: '', marks: [] }]], [[{ text: '', marks: [] }], [{ text: '', marks: [] }]]],
    }),
    toMarkdown: tableMarkdown, toHTML: tableHTML,
  });
  registerBlock({
    type: 'toc', label: 'Table of contents', icon: '❋', group: null,
    component: TocBlock, create: () => ({}),
    toMarkdown: (_b, h) => tocMarkdown(h.doc),
    toHTML: (_b, h) => tocHTML(h.doc),
  });

  // Layout: columns + column (container blocks render their own children)
  registerBlock({
    type: 'column', label: 'Column', icon: '▯', group: null, container: true, slashHidden: true,
    component: Column, create: () => ({}),
    initChildren: (make) => [make('paragraph')],
    toMarkdown: (b, h) => h.renderChildrenRaw(b),
    toHTML: (b, h) => `<div class="sc-column">${h.renderChildrenRaw(b)}</div>`,
  });
  registerBlock({
    type: 'columns', label: 'Columns', icon: '▥', group: null, container: true,
    component: Columns, create: () => ({}),
    initChildren: (make) => {
      const col = () => { const c = make('column'); c.children = [make('paragraph')]; return c; };
      return [col(), col()];
    },
    toMarkdown: (b, h) => (b.children || []).map((c) => h.renderChildrenRaw(c)).filter(Boolean).join('\n\n'),
    toHTML: (b, h) => `<div class="sc-columns">${h.renderChildrenRaw(b)}</div>`,
  });
  registerBlock({
    type: 'page-link', label: 'Page link', icon: '📄', group: null,
    component: PageLinkBlock, create: (d = {}) => ({ docId: d.docId || '', title: d.title || '' }),
    toMarkdown: pageLinkMarkdown, toHTML: pageLinkHTML,
  });

  // Interactive blocks
  registerBlock({
    type: 'button', label: 'Button', icon: '🔘', group: null,
    component: ButtonBlock,
    create: (d = {}) => ({
      label: d.label || 'Button', url: d.url || '', target: d.target || '_self',
      action: d.action || 'link', variant: d.variant || 'filled',
      textColor: d.textColor || '', bgColor: d.bgColor || '', align: d.align || 'left',
    }),
    toMarkdown: buttonMarkdown, toHTML: buttonHTML,
  });
  registerBlock({
    type: 'accordion', label: 'Accordion', icon: '🪗', group: null, container: true,
    component: AccordionBlock,
    create: () => ({}),
    initChildren: (make) => {
      const item = make('accordion-item');
      item.children = [make('paragraph')];
      return [item];
    },
    toMarkdown: accordionMarkdown, toHTML: accordionHTML,
  });
  registerBlock({
    type: 'accordion-item', label: 'Accordion item', icon: '▸', group: null, container: true, slashHidden: true,
    component: AccordionItemBlock,
    create: (d = {}) => ({ segments: d.segments ? normalizeSegments(d.segments) : [createSegment(d.title || '')] }),
    initChildren: (make) => [make('paragraph')],
    toMarkdown: accordionItemMarkdown, toHTML: accordionItemHTML,
  });

  // Presentation: a slide (container) and a slides deck (container of slides).
  registerBlock({
    type: 'slide', label: 'Slide', icon: '🖼', group: null, container: true,
    component: SlideBlock,
    create: (d = {}) => ({ aspect: d.aspect || '16x9' }),
    initChildren: (make) => [make('paragraph')],
    toMarkdown: slideMarkdown, toHTML: slideHTML,
  });
  registerBlock({
    type: 'slides', label: 'Slides (presentation)', icon: '🎞', group: null, container: true,
    component: SlidesBlock,
    create: () => ({}),
    initChildren: (make) => {
      const slide = make('slide');
      slide.children = [make('paragraph')];
      return [slide];
    },
    toMarkdown: slidesMarkdown, toHTML: slidesHTML,
  });
}
