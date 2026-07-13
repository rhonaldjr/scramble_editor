// Page style controls + export. A small fixed control bar toggles full width,
// small text, and font (default/serif/mono), persisting to doc.style, plus
// Markdown/HTML export links. Style is applied as classes on the editor root.

import { exportUrl } from './api.js';

const FONTS = ['default', 'serif', 'mono'];

/** Apply a doc.style object to the editor root as classes. */
export function applyStyle(root, style = {}) {
  root.classList.toggle('sc-full-width', Boolean(style.fullWidth));
  root.classList.toggle('sc-small-text', Boolean(style.smallText));
  FONTS.forEach((f) => root.classList.toggle(`sc-font-${f}`, (style.font || 'default') === f));
}

export function initPageStyle(state, root, { onChange, locked = false } = {}) {
  const doc = state.doc;
  doc.style = doc.style || { fullWidth: false, smallText: false, font: 'default' };
  applyStyle(root, doc.style);

  const bar = document.createElement('div');
  bar.className = 'sc-pagebar';

  if (!locked) {
    bar.appendChild(toggle('Full width', doc.style.fullWidth, (on) => set('fullWidth', on)));
    bar.appendChild(toggle('Small text', doc.style.smallText, (on) => set('smallText', on)));

    const font = document.createElement('select');
    font.className = 'sc-pagebar__select';
    FONTS.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f[0].toUpperCase() + f.slice(1);
      if ((doc.style.font || 'default') === f) opt.selected = true;
      font.appendChild(opt);
    });
    font.addEventListener('change', () => set('font', font.value));
    bar.appendChild(font);
  } else {
    const badge = document.createElement('span');
    badge.className = 'sc-pagebar__badge';
    badge.textContent = 'Locked';
    bar.appendChild(badge);
  }

  bar.appendChild(exportLink('Export MD', 'markdown'));
  bar.appendChild(exportLink('Export HTML', 'html'));
  document.body.appendChild(bar);

  function set(key, value) {
    doc.style[key] = value;
    applyStyle(root, doc.style);
    if (onChange) onChange();
  }

  function exportLink(label, format) {
    const a = document.createElement('a');
    a.className = 'sc-pagebar__btn';
    a.textContent = label;
    a.href = exportUrl(doc.id, format);
    a.setAttribute('download', '');
    return a;
  }
}

function toggle(label, initial, onToggle) {
  const wrap = document.createElement('label');
  wrap.className = 'sc-pagebar__toggle';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = Boolean(initial);
  box.addEventListener('change', () => onToggle(box.checked));
  wrap.appendChild(box);
  wrap.appendChild(document.createTextNode(label));
  return wrap;
}
