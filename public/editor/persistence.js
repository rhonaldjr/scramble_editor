// Client persistence: debounced autosave on any mutation, plus manual save
// (Ctrl/Cmd+S). Emits `document:saved` after a successful write. Saves are
// coalesced — one in flight at a time, with a trailing save when more edits
// land mid-flight.

import { saveDocument } from './api.js';
import { EVENTS, MUTATION_EVENTS, emit } from './events.js';

export function initPersistence(state, root, { delay = 800 } = {}) {
  let timer = null;
  let saving = false;
  let pending = false;

  async function save() {
    if (saving) {
      pending = true; // an edit landed while saving; save again afterwards
      return;
    }
    saving = true;
    pending = false;
    clearTimeout(timer);
    try {
      const saved = await saveDocument(state.doc);
      state.doc.updatedAt = saved.updatedAt;
      emit(root, EVENTS.DOCUMENT_SAVED, { id: state.doc.id, at: saved.updatedAt });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Scramble] save failed', err);
    } finally {
      saving = false;
      if (pending) schedule();
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(save, delay);
  }

  MUTATION_EVENTS.forEach((name) => root.addEventListener(name, schedule));

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
  });

  return { save, schedule };
}
