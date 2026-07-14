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

test('the same image outside a slide is not fit-constrained', async () => {
  const doc = {
    id: 'd', title: 't', style: {},
    blocks: [{ id: 'img', type: 'image', data: { url: 'http://x/a.png', width: null }, props: {}, children: [] }],
  };
  const wrapper = mount(ScrambleEditor, { props: { modelValue: doc } });
  await flushPromises();
  expect(wrapper.find('.sc-media').classes()).not.toContain('sc-fit');
});

test('readonly renders without contenteditable', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc(), readonly: true } });
  await flushPromises();
  expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false);
  expect(wrapper.text()).toContain('Hello');
});
