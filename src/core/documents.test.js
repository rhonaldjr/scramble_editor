import { test, expect } from 'vitest';
import { detectDocType, docTypeLabel, docTypeIcon, defaultViewerUrl } from './documents.js';

test('detectDocType maps extensions (ignoring query/hash) and mime types', () => {
  expect(detectDocType('report.pdf')).toBe('pdf');
  expect(detectDocType('https://x.com/a/deck.pptx?token=1#p2')).toBe('powerpoint');
  expect(detectDocType('sheet.xlsx')).toBe('excel');
  expect(detectDocType('notes.odt')).toBe('word');
  expect(detectDocType('data.csv')).toBe('excel');
  expect(detectDocType('unknown.zip')).toBe('');
  // mime fallback when the name has no useful extension
  expect(detectDocType('blob', 'application/pdf')).toBe('pdf');
  expect(detectDocType('blob', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('word');
});

test('labels and icons are family-based with sane fallbacks', () => {
  expect(docTypeLabel('pdf')).toBe('PDF');
  expect(docTypeLabel('excel')).toBe('Spreadsheet');
  expect(docTypeLabel('')).toBe('File');
  expect(docTypeIcon('powerpoint')).toBe('📊');
  expect(docTypeIcon('')).toBe('📎');
});

test('defaultViewerUrl: PDFs render directly, public Office via Office viewer', () => {
  expect(defaultViewerUrl('https://x.com/a.pdf', 'pdf')).toBe('https://x.com/a.pdf');
  expect(defaultViewerUrl('data:application/pdf;base64,AAAA', 'pdf')).toBe('data:application/pdf;base64,AAAA');
  expect(defaultViewerUrl('https://x.com/a.docx', 'word')).toBe(
    'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent('https://x.com/a.docx'),
  );
});

test('defaultViewerUrl: non-public Office URLs return "" (host must resolve)', () => {
  expect(defaultViewerUrl('data:application/vnd...;base64,AAA', 'word')).toBe('');
  expect(defaultViewerUrl('blob:abc', 'excel')).toBe('');
  expect(defaultViewerUrl('', 'pdf')).toBe('');
});
