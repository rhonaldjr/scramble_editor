// JSON file storage for documents. One file per document under data/documents/.
// No database. Cross-platform: always path.join, never POSIX-only paths. The
// data directory is overridable via SCRAMBLE_DATA_DIR (used by tests).

import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SCRAMBLE_DATA_DIR || path.join(__dirname, '..', 'data');
const DOCS_DIR = path.join(DATA_DIR, 'documents');

// Guards the id before it ever touches the filesystem (no path traversal).
const ID_RE = /^[A-Za-z0-9_-]+$/;

async function ensureDir() {
  await fsp.mkdir(DOCS_DIR, { recursive: true });
}

function docPath(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    throw new Error(`invalid document id: ${id}`);
  }
  return path.join(DOCS_DIR, `${id}.json`);
}

export function newDocId() {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyParagraph() {
  return {
    id: `blk-${Math.random().toString(36).slice(2, 9)}`,
    type: 'paragraph',
    data: { segments: [{ text: '', marks: [] }] },
    props: {},
    children: [],
  };
}

/** Fill in defaults for a new document. */
export function createDocumentData(partial = {}) {
  return {
    id: partial.id || newDocId(),
    title: partial.title || 'Untitled',
    config: partial.config || 'default',
    style: partial.style || { fullWidth: false, smallText: false, font: 'default' },
    blocks: partial.blocks && partial.blocks.length ? partial.blocks : [emptyParagraph()],
    updatedAt: new Date().toISOString(),
  };
}

/** Summaries of every stored document, newest first. */
export async function listDocuments() {
  await ensureDir();
  const files = await fsp.readdir(DOCS_DIR);
  const out = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(await fsp.readFile(path.join(DOCS_DIR, file), 'utf8'));
      out.push({ id: doc.id, title: doc.title, updatedAt: doc.updatedAt });
    } catch {
      // skip unreadable/corrupt files rather than failing the whole listing
    }
  }
  out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return out;
}

/** Read a document, or null when it does not exist. */
export async function readDocument(id) {
  try {
    return JSON.parse(await fsp.readFile(docPath(id), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Write a document, stamping updatedAt. Returns the saved copy. */
export async function writeDocument(doc) {
  await ensureDir();
  const toSave = { ...doc, updatedAt: new Date().toISOString() };
  await fsp.writeFile(docPath(doc.id), JSON.stringify(toSave, null, 2), 'utf8');
  return toSave;
}

/** Create and persist a new document from a partial. */
export async function createDocument(partial) {
  return writeDocument(createDocumentData(partial));
}

/** Delete a document. Returns true when a file was removed. */
export async function deleteDocument(id) {
  try {
    await fsp.unlink(docPath(id));
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}
