// Hardcoded sample document used until persistence lands (Phase 5). Exercises
// every Phase 1 block type, inline marks, and nested children.

export const sampleDoc = {
  id: 'doc-sample',
  title: 'Welcome to Scramble',
  config: 'default',
  style: { fullWidth: false, smallText: false, font: 'default' },
  updatedAt: '2026-07-13T00:00:00.000Z',
  blocks: [
    {
      id: 'blk-h1',
      type: 'heading-1',
      data: { segments: [{ text: 'Welcome to Scramble', marks: [] }] },
      props: {},
      children: [],
    },
    {
      id: 'blk-intro',
      type: 'paragraph',
      data: {
        segments: [
          { text: 'A block editor where everything is ', marks: [] },
          { text: 'pure data', marks: ['bold'] },
          { text: '. Try ', marks: [] },
          { text: 'editing', marks: ['italic'] },
          { text: ' this text.', marks: [] },
        ],
      },
      props: {},
      children: [],
    },
    { id: 'blk-div', type: 'divider', data: {}, props: {}, children: [] },
    {
      id: 'blk-h2',
      type: 'heading-2',
      data: { segments: [{ text: 'Nesting works', marks: [] }] },
      props: {},
      children: [],
    },
    {
      id: 'blk-b1',
      type: 'bulleted-list',
      data: { segments: [{ text: 'Top-level bullet', marks: [] }] },
      props: {},
      children: [
        {
          id: 'blk-b1a',
          type: 'bulleted-list',
          data: { segments: [{ text: 'Nested bullet', marks: ['italic'] }] },
          props: {},
          children: [],
        },
      ],
    },
    {
      id: 'blk-n1',
      type: 'numbered-list',
      data: { segments: [{ text: 'First step', marks: [] }] },
      props: {},
      children: [],
    },
    {
      id: 'blk-n2',
      type: 'numbered-list',
      data: { segments: [{ text: 'Second step', marks: [] }] },
      props: {},
      children: [],
    },
    {
      id: 'blk-c1',
      type: 'checklist',
      data: { segments: [{ text: 'Ship Phase 1', marks: [] }], checked: true },
      props: {},
      children: [],
    },
    {
      id: 'blk-c2',
      type: 'checklist',
      data: { segments: [{ text: 'Ship Phase 2', marks: [] }], checked: false },
      props: {},
      children: [],
    },
    {
      id: 'blk-q1',
      type: 'quote',
      data: { segments: [{ text: 'Blocks are pure data.', marks: ['italic'] }] },
      props: {},
      children: [],
    },
  ],
};
