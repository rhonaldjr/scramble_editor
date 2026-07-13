import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import documentsRouter from './api/documents.js';
import configsRouter from './api/configs.js';
import { bus, SERVER_EVENTS } from './events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use('/api/documents', documentsRouter);
app.use('/api/configs', configsRouter);
app.use(express.static(PUBLIC_DIR));

// Log persistence activity to the server console.
bus.on(SERVER_EVENTS.DOCUMENT_LOADED, ({ id }) => console.log(`[Scramble] loaded ${id}`));
bus.on(SERVER_EVENTS.DOCUMENT_SAVED, ({ id }) => console.log(`[Scramble] saved ${id}`));

app.listen(PORT, () => {
  console.log(`Scramble running at http://localhost:${PORT}`);
});
