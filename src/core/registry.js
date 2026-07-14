// Block registry. Each definition ties a block type to its Vue component plus
// metadata + export functions. Extensions register their own here.
//
// definition = {
//   type, label, icon, group,        // group = Turn Into group ('text' | null)
//   component,                       // Vue component for view/edit
//   componentProps?,                 // extra props passed to the component
//   editableText?, listMarker?, continuationType?, void?,
//   create(data) => blockData,
//   toMarkdown(block, helpers) => string,
//   toHTML(block, helpers) => string,
// }

const registry = new Map();

export function registerBlock(def) {
  if (!def || typeof def.type !== 'string' || !def.type) {
    throw new Error('registerBlock: a non-empty string "type" is required');
  }
  registry.set(def.type, def);
  return def;
}

export function getBlock(type) {
  return registry.get(type) || null;
}

export function hasBlock(type) {
  return registry.has(type);
}

export function listBlocks() {
  return [...registry.values()];
}

export function clearRegistry() {
  registry.clear();
}
