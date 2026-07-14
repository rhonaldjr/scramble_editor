// Editor context shared with every block via provide/inject. ScrambleEditor.vue
// creates it; blocks call useEditor() to read state and run mutations.
import { inject } from 'vue';

export const EditorKey = Symbol('scramble-editor');

export function useEditor() {
  const ctx = inject(EditorKey, null);
  if (!ctx) throw new Error('useEditor() must be called inside <ScrambleEditor>');
  return ctx;
}
