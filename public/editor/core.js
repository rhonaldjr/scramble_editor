// Scramble editor entry point. Registers built-in blocks, loads (or creates)
// a document from the server, renders it in edit mode, and wires live editing,
// interaction modules, persistence, and event logging.
//
// Public surface re-exported for extensions and Phase 9's Scramble API.

import { registerBlock, getBlock, listBlocks, hasBlock } from './registry.js';
import { registerBuiltins } from './blocks/index.js';
import { renderDocument } from './render.js';
import { initEditing } from './editing.js';
import { initSlashMenu } from './slash-menu.js';
import { initShortcuts } from './shortcuts.js';
import { initToolbar } from './toolbar.js';
import { initHandleMenu } from './handle-menu.js';
import { initPersistence } from './persistence.js';
import { initPageStyle } from './page-style.js';
import { listDocuments, getDocument, createDocument, getConfig } from './api.js';
import { attachLogger, emit, EVENTS } from './events.js';
import { sampleDoc } from './sample-doc.js';

export { registerBlock, getBlock, listBlocks, hasBlock };

// Permissive fallback when the server or a named config is unavailable.
const FALLBACK_CONFIG = {
  name: 'default',
  output: 'markdown',
  blocks: null, // null = all registered blocks allowed
  toolbar: ['bold', 'italic', 'underline', 'strikethrough', 'code', 'link'],
  locked: false,
  style: { fullWidth: false, smallText: false, font: 'default' },
};

async function loadConfig(name) {
  try {
    return (await getConfig(name || 'default')) || FALLBACK_CONFIG;
  } catch {
    return FALLBACK_CONFIG;
  }
}

// Load the most recent document, seeding a first one from the sample when the
// store is empty. Falls back to an in-memory sample if the server is offline.
async function loadOrCreateDoc() {
  try {
    const list = await listDocuments();
    if (list.length) return await getDocument(list[0].id);
    return await createDocument({
      title: sampleDoc.title,
      blocks: sampleDoc.blocks,
      style: sampleDoc.style,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Scramble] server unavailable, using in-memory document', err);
    return sampleDoc;
  }
}

async function boot() {
  const root = document.getElementById('editor');
  if (!root) return;

  registerBuiltins();
  attachLogger(root);

  const doc = await loadOrCreateDoc();
  const config = await loadConfig(doc.config);
  const state = { doc, config };
  const locked = Boolean(config.locked);

  renderDocument(state.doc, root, { editable: !locked });

  if (!locked) {
    const persistence = initPersistence(state, root);
    state.persistence = persistence;
    initEditing(state, root);
    initSlashMenu(state, root);
    initShortcuts(state, root);
    initToolbar(state, root);
    initHandleMenu(state, root);
    initPageStyle(state, root, { onChange: () => persistence.schedule() });
  } else {
    // Locked: view-only. No editing modules, no autosave.
    initPageStyle(state, root, { locked: true });
  }

  emit(root, EVENTS.READY, { docId: state.doc.id, locked });

  // Expose a minimal global for console poking and future extensions.
  window.Scramble = { registerBlock, getBlock, listBlocks, state };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
