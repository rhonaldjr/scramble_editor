// Thin client for the documents API.

const BASE = '/api/documents';

async function json(res) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function listDocuments() {
  return fetch(BASE).then(json);
}

export function getDocument(id) {
  return fetch(`${BASE}/${encodeURIComponent(id)}`).then(json);
}

export function createDocument(body = {}) {
  return fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(json);
}

export function saveDocument(doc) {
  return fetch(`${BASE}/${encodeURIComponent(doc.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  }).then(json);
}

export function getConfig(name) {
  return fetch(`/api/configs/${encodeURIComponent(name)}`).then(json);
}

/** URL that streams a document export (used as an <a download> target). */
export function exportUrl(id, format) {
  return `${BASE}/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}`;
}
