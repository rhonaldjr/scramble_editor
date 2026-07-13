// Divider: a non-text, non-convertible structural block.

export const divider = {
  type: 'divider',
  label: 'Divider',
  icon: '―',
  turnIntoGroup: null,
  editableText: false,
  create: () => ({}),
  renderView: () => {
    const hr = document.createElement('hr');
    hr.className = 'sc-divider';
    return hr;
  },
  renderEdit: () => {
    const hr = document.createElement('hr');
    hr.className = 'sc-divider';
    return hr;
  },
  toMarkdown: () => '---',
  toHTML: () => '<hr>',
};
