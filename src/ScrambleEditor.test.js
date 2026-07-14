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

test('readonly renders without contenteditable', async () => {
  const wrapper = mount(ScrambleEditor, { props: { modelValue: sampleDoc(), readonly: true } });
  await flushPromises();
  expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false);
  expect(wrapper.text()).toContain('Hello');
});
