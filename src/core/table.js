// Table cell model + operations. Pure, framework-free (Vitest-covered).
//
// A cell is an object: { segments, colSpan?, rowSpan?, covered? }.
//  - `segments` is the rich-text content.
//  - `colSpan`/`rowSpan` (>1) mark a merged anchor cell.
//  - `covered` marks a cell hidden underneath a merge anchor.
// Legacy tables stored a cell as a bare segments array; `normalizeTable`
// upgrades those. The grid stays rectangular (covered cells are placeholders),
// which keeps row/column indexing simple.

export function emptyCell() {
  return { segments: [{ text: '', marks: [] }] };
}

export function cellSegments(cell) {
  if (Array.isArray(cell)) return cell;
  return (cell && cell.segments) || [{ text: '', marks: [] }];
}

export function toCell(cell) {
  if (Array.isArray(cell)) return { segments: cell };
  return { ...cell, segments: (cell && cell.segments) || [{ text: '', marks: [] }] };
}

export function normalizeTable(rows) {
  return (rows || []).map((row) => row.map(toCell));
}

// Recompute `covered` flags and clamp spans so the grid is always valid.
// First anchor wins on overlap; spans are clamped to the grid bounds.
export function sanitizeSpans(rows) {
  const R = rows.length;
  const C = R ? rows[0].length : 0;
  for (const row of rows) for (const cell of row) delete cell.covered;
  const occupied = Array.from({ length: R }, () => new Array(C).fill(false));
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = rows[r][c];
      if (occupied[r][c]) { cell.covered = true; delete cell.colSpan; delete cell.rowSpan; continue; }
      let cs = Math.max(1, Math.min(cell.colSpan || 1, C - c));
      let rs = Math.max(1, Math.min(cell.rowSpan || 1, R - r));
      // shrink the span if it would overlap an already-claimed cell
      for (let rr = r; rr < r + rs; rr++) {
        for (let cc = c; cc < c + cs; cc++) {
          if ((rr !== r || cc !== c) && occupied[rr][cc]) cs = Math.min(cs, cc - c || 1);
        }
      }
      if (cs > 1) cell.colSpan = cs; else delete cell.colSpan;
      if (rs > 1) cell.rowSpan = rs; else delete cell.rowSpan;
      for (let rr = r; rr < r + rs; rr++) for (let cc = c; cc < c + cs; cc++) occupied[rr][cc] = true;
    }
  }
  return rows;
}

// Merge the cell at (r,c) one step in `dir` ('right' | 'down'). Returns whether
// it merged (false at the grid edge).
export function mergeCells(rows, r, c, dir) {
  const cell = rows[r] && rows[r][c];
  if (!cell || cell.covered) return false;
  if (dir === 'right') {
    if (c + (cell.colSpan || 1) >= rows[0].length) return false;
    cell.colSpan = (cell.colSpan || 1) + 1;
  } else if (dir === 'down') {
    if (r + (cell.rowSpan || 1) >= rows.length) return false;
    cell.rowSpan = (cell.rowSpan || 1) + 1;
  } else {
    return false;
  }
  sanitizeSpans(rows);
  return true;
}

// Split a merged cell back into single cells (covered cells become empty).
export function splitCell(rows, r, c) {
  const cell = rows[r] && rows[r][c];
  if (!cell || cell.covered) return false;
  if ((cell.colSpan || 1) === 1 && (cell.rowSpan || 1) === 1) return false;
  delete cell.colSpan;
  delete cell.rowSpan;
  sanitizeSpans(rows);
  return true;
}

export function addRow(rows) {
  const cols = rows[0] ? rows[0].length : 1;
  rows.push(Array.from({ length: cols }, emptyCell));
  sanitizeSpans(rows);
}
export function addColumn(rows) {
  rows.forEach((row) => row.push(emptyCell()));
  sanitizeSpans(rows);
}
export function deleteRow(rows, r) {
  if (rows.length <= 1) return;
  rows.splice(r, 1);
  sanitizeSpans(rows);
}
export function deleteColumn(rows, c) {
  if (!rows[0] || rows[0].length <= 1) return;
  rows.forEach((row) => row.splice(c, 1));
  sanitizeSpans(rows);
}
