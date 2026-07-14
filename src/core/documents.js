// Document viewer helpers — pure, framework-free (Vitest-covered). The
// DocumentBlock uses these to detect a document's type from its URL/name/mime
// and to resolve a default embeddable viewer URL. The host can override the
// resolution entirely via `adapters.resolveDocumentUrl` (see DocumentBlock).

// extension → coarse family used for icon/label + rendering strategy.
export const DOC_EXTENSIONS = {
  pdf: 'pdf',
  doc: 'word', docx: 'word', odt: 'word', rtf: 'word',
  ppt: 'powerpoint', pptx: 'powerpoint', odp: 'powerpoint',
  xls: 'excel', xlsx: 'excel', ods: 'excel', csv: 'excel',
};

// A few mime types → family (for uploads whose name lacks an extension).
const MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.oasis.opendocument.text': 'word',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
  'application/vnd.oasis.opendocument.presentation': 'powerpoint',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.oasis.opendocument.spreadsheet': 'excel',
  'text/csv': 'excel',
};

const LABELS = { pdf: 'PDF', word: 'Document', powerpoint: 'Presentation', excel: 'Spreadsheet' };
const ICONS = { pdf: '📕', word: '📄', powerpoint: '📊', excel: '📈' };

export function extensionOf(source = '') {
  const clean = String(source).split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase();
}

// Detect the document family from a filename/URL and/or a mime type.
export function detectDocType(source = '', mime = '') {
  if (mime && MIME_TYPES[mime]) return MIME_TYPES[mime];
  return DOC_EXTENSIONS[extensionOf(source)] || '';
}

export function docTypeLabel(type) { return LABELS[type] || 'File'; }
export function docTypeIcon(type) { return ICONS[type] || '📎'; }

export function isPreviewableUrl(url = '') {
  return /^https?:\/\//i.test(url);
}

// Default viewer URL. PDFs render natively (data:/blob:/http all work in an
// iframe). Office/ODF formats need a *public* URL routed through the Microsoft
// Office Online viewer; if the URL isn't public we return '' so the block can
// show a graceful fallback (host should supply `resolveDocumentUrl`).
export function defaultViewerUrl(url = '', type = '') {
  if (!url) return '';
  const kind = type || detectDocType(url);
  if (kind === 'pdf') return url;
  if (!isPreviewableUrl(url)) return '';
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}
