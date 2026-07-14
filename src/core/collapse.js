// Collapse helpers. Pure — framework-free, testable.

/** Heading level (1-3) for a block type, or 0 when not a heading. */
export function headingLevel(type) {
  const match = /^heading-([1-3])$/.exec(type || '');
  return match ? Number(match[1]) : 0;
}

/**
 * Filter out blocks hidden by a collapsed heading: a collapsed heading hides
 * following siblings until a heading of the same or higher level (lower/equal
 * number). Applies within any sibling list (top-level or a block's children).
 */
export function visibleAfterCollapse(blocks) {
  const out = [];
  let skipLevel = 0;
  for (const block of blocks) {
    const level = headingLevel(block.type);
    if (skipLevel > 0) {
      if (level > 0 && level <= skipLevel) skipLevel = 0;
      else continue;
    }
    out.push(block);
    if (level > 0 && block.props && block.props.collapsed) skipLevel = level;
  }
  return out;
}
