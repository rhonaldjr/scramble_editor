// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { h, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { ScrambleEditor } from './index.js';

function sampleDoc() {
  return {
    id: 'd',
    title: 't',
    style: {},
    blocks: [
      { id: 'h', type: 'heading-1', data: { segments: [{ text: 'Hello', marks: [] }] }, props: {}, children: [] },
      { id: 'p', type: 'paragraph', data: { segments: [{ text: 'World', marks: [] }] }, props: {}, children: [] },
    ],
  };
}

test('renders block text and exposes exporters', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc() } });
  await flushPromises();
  expect(wrapper.text()).toContain('Hello');
  expect(wrapper.vm.getMarkdown()).toContain('# Hello');
  expect(wrapper.vm.getHTML()).toContain('<h1>Hello</h1>');
});

test('v-model prop change re-renders the document', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc() } });
  await flushPromises();
  await wrapper.setProps({
    modelValue: { id: 'd', title: 't', style: {}, blocks: [{ id: 'x', type: 'paragraph', data: { segments: [{ text: 'Changed', marks: [] }] }, props: {}, children: [] }] },
  });
  await flushPromises();
  await nextTick();
  expect(wrapper.text()).toContain('Changed');
});

test('footer slot receives the word count', async () => {
  const wrapper = mount(ScrambleEditor, {
    props: { modelValue: sampleDoc() },
    slots: { footer: (p) => h('span', { class: 'wc' }, `${p.words} words`) },
  });
  await flushPromises();
  expect(wrapper.find('.wc').text()).toBe('2 words');
  expect(wrapper.vm.getWordCount().words).toBe(2);
});

test('pasting rich HTML inserts structured blocks instead of flattening', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc() } });
  await flushPromises();
  const target = wrapper.findAll('[data-role="content"]')[1]; // the 'World' paragraph
  const html = '<h2>Section</h2><p>Body</p><ul><li>Item</li></ul>';
  const event = new Event('paste', { bubbles: true, cancelable: true });
  event.clipboardData = { getData: (t) => (t === 'text/html' ? html : 'Section Body Item') };
  target.element.dispatchEvent(event);
  await flushPromises();
  await nextTick();
  const types = wrapper.vm.getDocument().blocks.map((b) => b.type);
  expect(types).toContain('heading-2');
  expect(types).toContain('bulleted-list');
  expect(wrapper.vm.getMarkdown()).toContain('## Section');
});

test('backspace in an empty nested list item outdents before merging', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [
      {
        id: 'a', type: 'bulleted-list', data: { segments: [{ text: 'Parent', marks: [] }] }, props: {},
        children: [{ id: 'b', type: 'bulleted-list', data: { segments: [{ text: '', marks: [] }] }, props: {}, children: [] }],
      },
    ],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  const nested = wrapper.findAll('[data-role="content"]')[1];
  nested.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
  await flushPromises();
  await nextTick();
  const top = wrapper.vm.getDocument().blocks;
  // 'b' climbed out to the top level (no longer a child of 'a')
  expect(top.map((x) => x.id)).toEqual(['a', 'b']);
  expect(top[0].children.length).toBe(0);
});

test('width prop applies viewport presets (full / 75% / 50%)', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc(), width: 'full' } });
  await flushPromises();
  const root = wrapper.find('.scramble-editor').element;
  expect(root.style.maxWidth).toBe('100%');
  await wrapper.setProps({ width: '75%' });
  await nextTick();
  expect(root.style.maxWidth).toBe('75%');
  await wrapper.setProps({ width: '50%' });
  await nextTick();
  expect(root.style.maxWidth).toBe('50%');
  await wrapper.setProps({ width: 'normal' });
  await nextTick();
  expect(root.style.maxWidth).toBe('');
});

function docWithBlock(data) {
  return {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'doc1', type: 'document', data: { url: '', name: '', docType: '', width: null, height: 400, ...data }, props: {}, children: [] }],
  };
}

test('document block previews a PDF natively (default resolver)', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: docWithBlock({ url: 'https://x.com/a.pdf' }) } });
  await flushPromises();
  const frame = wrapper.find('.sc-document__frame');
  expect(frame.exists()).toBe(true);
  expect(frame.attributes('src')).toBe('https://x.com/a.pdf');
});

test('document block uses a host resolveDocumentUrl adapter when provided', async () => {
  const adapters = { resolveDocumentUrl: async ({ url }) => `https://viewer/?f=${encodeURIComponent(url)}` };
  const wrapper = mount(ScrambleEditor, {
    props: { modelValue: docWithBlock({ url: 'https://x.com/a.docx' }), adapters },
  });
  await flushPromises();
  await nextTick();
  expect(wrapper.find('.sc-document__frame').attributes('src')).toBe('https://viewer/?f=' + encodeURIComponent('https://x.com/a.docx'));
});

test('document block renders host-provided HTML (client-side docx/xlsx) via srcdoc', async () => {
  const adapters = { resolveDocumentUrl: async () => ({ html: '<p>Rendered body</p>' }) };
  const wrapper = mount(ScrambleEditor, {
    props: { modelValue: docWithBlock({ url: 'data:application/vnd;base64,AA', docType: 'word' }), adapters },
  });
  await flushPromises();
  await nextTick();
  const frame = wrapper.find('.sc-document__frame');
  expect(frame.exists()).toBe(true);
  expect(frame.attributes('src')).toBeUndefined();
  expect(frame.attributes('srcdoc')).toContain('Rendered body');
});

test('document block shows a fallback when an office file has no viewable URL', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: docWithBlock({ url: 'data:application/vnd;base64,AA', docType: 'word' }) } });
  await flushPromises();
  await nextTick();
  expect(wrapper.find('.sc-document__frame').exists()).toBe(false);
  expect(wrapper.find('.sc-document__fallback').exists()).toBe(true);
});

test('slides deck: add slide, set background, and enter present mode', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'deck', type: 'slides', data: {}, props: {}, children: [
        { id: 's1', type: 'slide', data: { aspect: '16x9' }, props: {}, children: [
          { id: 'p1', type: 'paragraph', data: { segments: [{ text: 'Hi', marks: [] }] }, props: {}, children: [] },
        ] },
      ],
    }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();

  // Add a slide via the deck toolbar
  await wrapper.find('.sc-slides__btn').trigger('mousedown');
  await nextTick();
  expect(wrapper.vm.getDocument().blocks[0].children.length).toBe(2);

  // Enter present mode
  await wrapper.find('.sc-slides__btn--go').trigger('mousedown');
  await nextTick();
  expect(wrapper.find('.sc-present').exists()).toBe(true);
  expect(wrapper.find('.sc-present__count').text()).toContain('1 /');
});

test('slide/deck export to HTML with a background through the editor', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'deck', type: 'slides', data: {}, props: {}, children: [
        { id: 's1', type: 'slide', data: {}, props: { backgroundColor: 'navy' }, children: [
          { id: 'p1', type: 'paragraph', data: { segments: [{ text: 'Slide one', marks: [] }] }, props: {}, children: [] },
        ] },
      ],
    }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  const html = wrapper.vm.getHTML();
  expect(html).toContain('<section class="sc-slide" style="background:navy">');
  expect(html).toContain('Slide one');
});

test('media inside a slide auto-fits (sc-fit, no fixed width) until resized', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'deck', type: 'slides', data: {}, props: {}, children: [
        { id: 's1', type: 'slide', data: {}, props: {}, children: [
          { id: 'img', type: 'image', data: { url: 'http://x/a.png', width: null, align: 'left' }, props: {}, children: [] },
        ] },
      ],
    }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  const fig = wrapper.find('.sc-media');
  expect(fig.classes()).toContain('sc-fit');           // fits the slide by default
  expect(fig.find('.sc-media__frame').attributes('style') || '').not.toContain('width:'); // no fixed px width

  // Give it an explicit width → drops fit, uses its own size (resizable)
  doc.blocks[0].children[0].children[0].data.width = 240;
  await wrapper.setProps({ modelValue: JSON.parse(JSON.stringify(doc)) });
  await nextTick();
  const fig2 = wrapper.find('.sc-media');
  expect(fig2.classes()).not.toContain('sc-fit');
  expect(fig2.find('.sc-media__frame').attributes('style')).toContain('width: 240px');
});

test('slide width is set via the gear (data.width → inline style), not by dragging', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'deck', type: 'slides', data: {}, props: {}, children: [
        { id: 's1', type: 'slide', data: { aspect: '16x9', width: 720 }, props: {}, children: [
          { id: 'p1', type: 'paragraph', data: { segments: [{ text: 'Hi', marks: [] }] }, props: {}, children: [] },
        ] },
      ],
    }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  const slide = wrapper.find('.sc-slide');
  expect(slide.attributes('style')).toContain('width: 720px');
  // the slide has no drag-resize handle of its own
  expect(slide.find('.sc-resize').exists()).toBe(false);
});

test('a slide with no gear width has no fixed width (fills the editor via CSS flex)', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'deck', type: 'slides', data: {}, props: {}, children: [
        { id: 's1', type: 'slide', data: { aspect: '16x9' }, props: {}, children: [
          { id: 'p1', type: 'paragraph', data: { segments: [{ text: '', marks: [] }] }, props: {}, children: [] },
        ] },
      ],
    }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  const style = wrapper.find('.sc-slide').attributes('style') || '';
  expect(style).not.toContain('width');
});

test('the same image outside a slide is not fit-constrained', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'img', type: 'image', data: { url: 'http://x/a.png', width: null }, props: {}, children: [] }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  expect(wrapper.find('.sc-media').classes()).not.toContain('sc-fit');
});

test('loadMarkdown replaces the whole document with structured blocks', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc() } });
  await flushPromises();
  wrapper.vm.loadMarkdown('# New\n\n- a\n- b');
  await flushPromises();
  await nextTick();
  const types = wrapper.vm.getDocument().blocks.map((b) => b.type);
  expect(types).toEqual(['heading-1', 'bulleted-list', 'bulleted-list']);
  expect(wrapper.text()).toContain('New');
});

test('setContent loads HTML into a specific block (replace / append / children)', async () => {
  const base = () => ({
    id: 'd', title: 't', style: {},
    blocks: [
      { id: 'a', type: 'paragraph', data: { segments: [{ text: 'A', marks: [] }] }, props: {}, children: [] },
      { id: 'b', type: 'paragraph', data: { segments: [{ text: 'B', marks: [] }] }, props: {}, children: [] },
    ],
  });

  // replace target block 'a' with parsed HTML
  let w = mount(ScrambleEditor, { props: { modelValue: base() } });
  await flushPromises();
  w.vm.setContent('<h2>X</h2><p>Y</p>', { format: 'html', blockId: 'a', mode: 'replace' });
  await flushPromises();
  let ids = w.vm.getDocument().blocks.map((x) => x.type);
  expect(ids).toEqual(['heading-2', 'paragraph', 'paragraph']); // a replaced by 2 blocks, b remains

  // append after 'a'
  w = mount(ScrambleEditor, { props: { modelValue: base() } });
  await flushPromises();
  w.vm.setContent('<p>ins</p>', { format: 'html', blockId: 'a', mode: 'append' });
  await flushPromises();
  const doc = w.vm.getDocument();
  expect(doc.blocks.map((x) => x.id)[0]).toBe('a');
  expect(doc.blocks.length).toBe(3);
});

test('slide gear shows a color selector; empty = transparent, picking sets a hex', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'deck', type: 'slides', data: {}, props: {}, children: [
        { id: 's1', type: 'slide', data: { aspect: '16x9' }, props: {}, children: [
          { id: 'p1', type: 'paragraph', data: { segments: [{ text: 'Hi', marks: [] }] }, props: {}, children: [] },
        ] },
      ],
    }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  // open the slide gear
  await wrapper.find('.sc-slide .sc-media__gear').trigger('mousedown');
  await nextTick();
  const picker = wrapper.find('.sc-gearcolor input[type="color"]');
  expect(picker.exists()).toBe(true);
  // default: no color set → swatch shows the transparent (empty) state
  expect(wrapper.find('.sc-gearcolor__swatch').classes()).toContain('is-empty');
  // picking a color updates the slide's background prop
  picker.element.value = '#0b1e3b';
  await picker.trigger('input');
  await nextTick();
  expect(wrapper.vm.getDocument().blocks[0].children[0].props.backgroundColor).toBe('#0b1e3b');
});

test('tokens prop applies host UI-theme overrides as inline CSS custom properties', async () => {
  const wrapper = mount(ScrambleEditor, {
    props: { modelValue: sampleDoc(), tokens: { accent: '#e0218a', 'bar-bg': '#2a0a24', '--sc-radius': '10px' } },
  });
  await flushPromises();
  const root = wrapper.find('.scramble-editor').element;
  expect(root.style.getPropertyValue('--sc-accent')).toBe('#e0218a');
  expect(root.style.getPropertyValue('--sc-bar-bg')).toBe('#2a0a24');
  expect(root.style.getPropertyValue('--sc-radius')).toBe('10px'); // already-prefixed key passes through
  // reactive: clearing removes the override
  await wrapper.setProps({ tokens: {} });
  await nextTick();
  expect(root.style.getPropertyValue('--sc-accent')).toBe('');
});

test('button block emits button-clicked with its config', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'b', type: 'button', data: { label: 'Run', action: 'event', url: '', target: '_self', variant: 'filled' }, props: {}, children: [] }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  await wrapper.find('.sc-button').trigger('click');
  const evt = wrapper.emitted('button-clicked');
  expect(evt).toBeTruthy();
  expect(evt[0][0]).toMatchObject({ id: 'b', label: 'Run', action: 'event' });
});

function accordionDoc() {
  return {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'acc', type: 'accordion', data: {}, props: {}, children: [
        { id: 'it1', type: 'accordion-item', data: { segments: [{ text: 'FAQ', marks: [] }] }, props: {}, children: [
          { id: 'body', type: 'paragraph', data: { segments: [{ text: 'Answer', marks: [] }] }, props: {}, children: [] },
        ] },
      ],
    }],
  };
}

test('accordion item toggles its body and renders an editable title', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: accordionDoc() } });
  await flushPromises();
  expect(wrapper.find('.sc-accordion-item__title').attributes('contenteditable')).toBe('true');
  expect(wrapper.text()).toContain('Answer'); // body visible by default
  await wrapper.find('.sc-accordion__chev').trigger('mousedown');
  await nextTick();
  expect(wrapper.vm.getDocument().blocks[0].children[0].props.collapsed).toBe(true);
});

test('accordion "+ Add accordion item" appends a new item', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: accordionDoc() } });
  await flushPromises();
  await wrapper.find('.sc-accordion__additem').trigger('mousedown');
  await nextTick();
  const items = wrapper.vm.getDocument().blocks[0].children;
  expect(items.length).toBe(2);
  expect(items[1].type).toBe('accordion-item');
  expect(items[1].children[0].type).toBe('paragraph');
});

test('legacy columns document is flattened on load (columns removed)', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{
      id: 'cols', type: 'columns', data: {}, props: {}, children: [
        { id: 'c1', type: 'column', data: {}, props: {}, children: [{ id: 'p1', type: 'paragraph', data: { segments: [{ text: 'Left col', marks: [] }] }, props: {}, children: [] }] },
        { id: 'c2', type: 'column', data: {}, props: {}, children: [{ id: 'p2', type: 'paragraph', data: { segments: [{ text: 'Right col', marks: [] }] }, props: {}, children: [] }] },
      ],
    }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  const types = wrapper.vm.getDocument().blocks.map((b) => b.type);
  expect(types).toEqual(['paragraph', 'paragraph']); // columns/column gone
  expect(wrapper.text()).toContain('Left col');
  expect(wrapper.text()).toContain('Right col');
});

test('table: floating toolbar on focus — merge cells + set width', async () => {
  const cell = (t) => [{ text: t, marks: [] }];
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'tbl', type: 'table', data: { rows: [[cell('A'), cell('B')], [cell('1'), cell('2')]] }, props: {}, children: [] }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  // toolbar is hidden until the table is focused
  expect(wrapper.find('.sc-tabletoolbar').exists()).toBe(false);

  const cell0 = wrapper.findAll('.sc-table__cell')[0];
  await cell0.trigger('focus');     // sets the active cell
  await cell0.trigger('focusin');   // reveals the floating toolbar (bubbles)
  await nextTick();
  expect(wrapper.find('.sc-tabletoolbar').exists()).toBe(true);

  // Merge right
  const mergeBtn = wrapper.findAll('.sc-tt__btn').find((b) => b.attributes('title') === 'Merge right');
  await mergeBtn.trigger('click');
  await nextTick();
  const rows = wrapper.vm.getDocument().blocks[0].data.rows;
  expect(rows[0][0].colSpan).toBe(2);
  expect(rows[0][1].covered).toBe(true);
  expect(wrapper.vm.getHTML()).toContain('<th colspan="2">A</th>');

  // Set table width to 50%
  const w50 = wrapper.findAll('.sc-tt__btn').find((b) => b.text() === '50%');
  await w50.trigger('click');
  await nextTick();
  expect(wrapper.vm.getDocument().blocks[0].data.width).toBe('50');
});

test('table toolbar: fill a whole row with a background color', async () => {
  const cell = (t) => [{ text: t, marks: [] }];
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'tbl', type: 'table', data: { rows: [[cell('A'), cell('B')], [cell('1'), cell('2')]] }, props: {}, children: [] }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  const cell0 = wrapper.findAll('.sc-table__cell')[0];
  await cell0.trigger('focus');
  await cell0.trigger('focusin');
  await nextTick();
  // scope = Row, then pick a color from the fill picker
  await wrapper.findAll('.sc-tt__btn').find((b) => b.text() === 'Row').trigger('click');
  const picker = wrapper.find('.sc-tt__fill input[type="color"]');
  picker.element.value = '#ffe2c2';
  await picker.trigger('input');
  await nextTick();
  const rows = wrapper.vm.getDocument().blocks[0].data.rows;
  expect(rows[0].every((c) => c.bg === '#ffe2c2')).toBe(true);
  expect(rows[1].every((c) => !c.bg)).toBe(true); // other rows untouched
  expect(wrapper.vm.getHTML()).toContain('style="background:#ffe2c2"');
});

test('block alignment (props.align) applies a content-aware class', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'p', type: 'paragraph', data: { segments: [{ text: 'Hi', marks: [] }] }, props: { align: 'center' }, children: [] }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  expect(wrapper.find('.sc-block').classes()).toContain('sc-align-center');
});

test('platform-content resolves via the adapter and renders + exports the HTML', async () => {
  const platformResolve = async ({ ids }) => ({ html: `<p>items:${(ids || []).join(',')}</p>` });
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'pc', type: 'platform-content', data: { heading: 'Feed', ids: ['a', 'b'], refresh: 'none', height: 200 }, props: {}, children: [] }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc, adapters: { platformResolve } } });
  await flushPromises();
  await nextTick();
  const frame = wrapper.find('.sc-platform__frame');
  expect(frame.exists()).toBe(true);
  expect(frame.attributes('srcdoc')).toContain('items:a,b');
  expect(wrapper.text()).toContain('Feed'); // heading
  expect(wrapper.vm.getHTML()).toContain('items:a,b'); // exported
});

test('platform-content shows a config prompt when unconfigured', async () => {
  const doc = { id: 'd', title: 't', style: {}, blocks: [{ id: 'pc', type: 'platform-content', data: { refresh: 'none' }, props: {}, children: [] }] };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc, adapters: { platformResolve: async () => ({ html: '' }) } } });
  await flushPromises();
  expect(wrapper.find('.sc-platform__placeholder').text()).toContain('search and pick');
});

test('readonly renders without contenteditable', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc(), readonly: true } });
  await flushPromises();
  expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false);
  expect(wrapper.text()).toContain('Hello');
});
