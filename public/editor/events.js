// Client event bus. Every mutation emits a CustomEvent on the editor root so
// features hook in through events rather than bypassing them (CLAUDE.md rule 5).

export const EVENTS = {
  READY: 'editor:ready',
  BLOCK_CREATED: 'block:created',
  BLOCK_UPDATED: 'block:updated',
  BLOCK_DELETED: 'block:deleted',
  BLOCK_MOVED: 'block:moved',
  BLOCK_CONVERTED: 'block:converted',
  BLOCK_DUPLICATED: 'block:duplicated',
  SELECTION_CHANGED: 'selection:changed',
  SLASH_OPENED: 'slash:opened',
  SLASH_SELECTED: 'slash:selected',
  SHORTCUT_APPLIED: 'shortcut:applied',
  DOCUMENT_SAVED: 'document:saved',
};

// Editor mutations that should trigger an autosave.
export const MUTATION_EVENTS = [
  EVENTS.BLOCK_CREATED,
  EVENTS.BLOCK_UPDATED,
  EVENTS.BLOCK_DELETED,
  EVENTS.BLOCK_MOVED,
  EVENTS.BLOCK_CONVERTED,
  EVENTS.BLOCK_DUPLICATED,
];

/** Dispatch a bubbling CustomEvent on the editor root. */
export function emit(root, name, detail = {}) {
  root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}

/** Dev aid (Roadmap Phase 2): log every editor event to the console. */
export function attachLogger(root) {
  Object.values(EVENTS).forEach((name) => {
    root.addEventListener(name, (event) => {
      // eslint-disable-next-line no-console
      console.log(`[Scramble] ${name}`, event.detail);
    });
  });
}
