import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';

// Point storage at a throwaway directory before importing it.
const TMP = path.join(os.tmpdir(), `scramble-store-${process.pid}`);
process.env.SCRAMBLE_DATA_DIR = TMP;

const store = await import('../server/storage.js');

test.after(async () => {
  await fsp.rm(TMP, { recursive: true, force: true });
});

test('createDocumentData fills defaults and a non-empty block list', () => {
  const doc = store.createDocumentData({ title: 'Hi' });
  assert.equal(doc.title, 'Hi');
  assert.equal(doc.config, 'default');
  assert.ok(doc.id.startsWith('doc-'));
  assert.equal(doc.blocks.length, 1);
  assert.equal(doc.blocks[0].type, 'paragraph');
});

test('create -> read round trips a document', async () => {
  const created = await store.createDocument({ title: 'Round trip' });
  const read = await store.readDocument(created.id);
  assert.equal(read.title, 'Round trip');
  assert.equal(read.id, created.id);
});

test('readDocument returns null for a missing id', async () => {
  assert.equal(await store.readDocument('doc-does-not-exist'), null);
});

test('writeDocument persists changes and stamps updatedAt', async () => {
  const created = await store.createDocument({ title: 'Before' });
  const saved = await store.writeDocument({ ...created, title: 'After' });
  assert.equal(saved.title, 'After');
  assert.ok(saved.updatedAt);
  assert.equal((await store.readDocument(created.id)).title, 'After');
});

test('listDocuments returns summaries newest-first', async () => {
  const list = await store.listDocuments();
  assert.ok(Array.isArray(list));
  assert.ok(list.every((d) => d.id && 'title' in d && 'updatedAt' in d));
  const sorted = [...list].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  assert.deepEqual(list.map((d) => d.id), sorted.map((d) => d.id));
});

test('deleteDocument removes a file and reports missing ones', async () => {
  const created = await store.createDocument({ title: 'Doomed' });
  assert.equal(await store.deleteDocument(created.id), true);
  assert.equal(await store.readDocument(created.id), null);
  assert.equal(await store.deleteDocument(created.id), false);
});

test('an invalid id is rejected (no path traversal)', async () => {
  await assert.rejects(() => store.writeDocument({ id: '../evil', title: 'x' }), /invalid document id/);
});
