// Unique-enough ids for a local editing session.
let counter = 0;

export function newId(prefix = 'blk') {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rand}${counter.toString(36)}`;
}
