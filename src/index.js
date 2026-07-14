// Public API — the documented, stable extension surface. See docs/extensions.md.
// The shape here is frozen within a major version (`version`).
import ScrambleEditor from './ScrambleEditor.vue';
import './styles.css';

// The component
export { ScrambleEditor };
export default {
  install(app) {
    app.component('ScrambleEditor', ScrambleEditor);
  },
};

// Version of the public contract.
export const version = '0.1.0';

// Block registration + lookup (register custom blocks here).
export { registerBlock, getBlock, listBlocks, hasBlock } from './core/registry.js';

// Editor context for custom block components (mutations, adapters, events).
export { useEditor } from './composables/editor.js';

// Export helpers (host may run these outside the component too).
export { toMarkdown, toHTML } from './core/exporter.js';

// Import helpers — parse HTML / Markdown into block descriptors ({ type, data }).
// Feed the results to the editor via its `setContent` / `loadHTML` / `loadMarkdown`
// methods, or build a document yourself.
export { htmlToBlocks } from './core/html-import.js';
export { markdownToBlocks } from './core/markdown-import.js';

// Segment helpers commonly needed when authoring block data + exporters.
export {
  createSegment,
  segmentsText,
  segmentsToHTML,
  segmentsToMarkdown,
  normalizeSegments,
} from './core/segments.js';
