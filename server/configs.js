// Page-config loading. Configs are JSON files under configs/. Read-only from
// the server's perspective; the editor filters its UI by them and the server
// enforces `locked`.

import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '..', 'configs');
const NAME_RE = /^[A-Za-z0-9_-]+$/;

/** Load a config by name, or null when it does not exist. */
export async function readConfig(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new Error(`invalid config name: ${name}`);
  }
  try {
    return JSON.parse(await fsp.readFile(path.join(CONFIG_DIR, `${name}.json`), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
