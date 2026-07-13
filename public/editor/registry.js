// Block registry. Pure data — no DOM. Safe to import in Node for tests.
// Registry contract lives in CLAUDE.md; blocks self-describe how to render,
// convert, and export.

/** @type {Map<string, object>} */
const registry = new Map();

/**
 * Register a block definition. Throws on a missing/duplicate type so mistakes
 * surface immediately rather than silently shadowing a built-in.
 * @param {object} def
 * @returns {object} the registered definition
 */
export function registerBlock(def) {
  if (!def || typeof def.type !== 'string' || def.type === '') {
    throw new Error('registerBlock: definition requires a non-empty string "type"');
  }
  if (typeof def.create !== 'function') {
    throw new Error(`registerBlock: "${def.type}" must provide a create() function`);
  }
  if (registry.has(def.type)) {
    throw new Error(`registerBlock: type "${def.type}" is already registered`);
  }
  registry.set(def.type, def);
  return def;
}

/** @returns {object|null} */
export function getBlock(type) {
  return registry.get(type) || null;
}

/** @returns {boolean} */
export function hasBlock(type) {
  return registry.has(type);
}

/** @returns {object[]} all registered definitions, insertion order */
export function listBlocks() {
  return [...registry.values()];
}

/** Test helper: wipe the registry so suites start from a clean slate. */
export function clearRegistry() {
  registry.clear();
}
