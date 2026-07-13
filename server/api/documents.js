// Document CRUD routes. Thin layer over storage.js; publishes document:loaded
// and document:saved on the server event hub.

import { Router } from 'express';
import * as store from '../storage.js';
import { readConfig } from '../configs.js';
import { toMarkdown, toHTMLDocument } from '../export.js';
import { bus, SERVER_EVENTS } from '../events.js';

const router = Router();

function safeFilename(title) {
  return String(title || 'document').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
}

// GET /api/documents — list summaries
router.get('/', async (_req, res, next) => {
  try {
    res.json(await store.listDocuments());
  } catch (err) {
    next(err);
  }
});

// POST /api/documents — create (optional { title, blocks, style, config })
router.post('/', async (req, res, next) => {
  try {
    const doc = await store.createDocument(req.body || {});
    bus.emit(SERVER_EVENTS.DOCUMENT_SAVED, { id: doc.id, doc });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id — load
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await store.readDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    bus.emit(SERVER_EVENTS.DOCUMENT_LOADED, { id: doc.id });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/documents/:id/export?format=markdown|html — export per config
router.get('/:id/export', async (req, res) => {
  try {
    const doc = await store.readDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    const config = await readConfig(doc.config || 'default').catch(() => null);
    const format = String(req.query.format || (config && config.output) || 'markdown').toLowerCase();
    bus.emit(SERVER_EVENTS.EXPORT_REQUESTED, { id: doc.id, format });

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(doc.title)}.html"`);
      return res.send(toHTMLDocument(doc));
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(doc.title)}.md"`);
    res.send(toMarkdown(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/documents/:id — save (rejected when the page config is locked)
router.put('/:id', async (req, res) => {
  const incoming = req.body;
  if (!incoming || incoming.id !== req.params.id) {
    return res.status(400).json({ error: 'body id must match url id' });
  }
  try {
    const config = await readConfig(incoming.config || 'default').catch(() => null);
    if (config && config.locked) {
      return res.status(403).json({ error: 'document is locked' });
    }
    const saved = await store.writeDocument(incoming);
    bus.emit(SERVER_EVENTS.DOCUMENT_SAVED, { id: saved.id, doc: saved });
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  try {
    const removed = await store.deleteDocument(req.params.id);
    res.status(removed ? 204 : 404).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
