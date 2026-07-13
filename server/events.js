// Server-side event hub. A single EventEmitter other modules publish to and
// subscribe from, so server features hook in through events (mirrors the
// client CustomEvent bus). Document the payload shape where you emit.

import { EventEmitter } from 'events';

/** Shared hub. Import and `bus.on(...)` / `bus.emit(...)`. */
export const bus = new EventEmitter();

export const SERVER_EVENTS = {
  // { id }               — a document was read from storage
  DOCUMENT_LOADED: 'document:loaded',
  // { id, doc }          — a document was written to storage
  DOCUMENT_SAVED: 'document:saved',
  // { id, format }       — an export was produced
  EXPORT_REQUESTED: 'export:requested',
};
