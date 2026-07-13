import test from 'node:test';
import assert from 'node:assert/strict';

import { domToSegments } from '../public/editor/editing.js';

// domToSegments only reads nodeType, childNodes, tagName, getAttribute and
// nodeValue, so a tiny fake DOM exercises it without a browser.
function text(value) {
  return { nodeType: 3, nodeValue: value };
}
function el(tag, children, attrs = {}) {
  return {
    nodeType: 1,
    tagName: tag,
    childNodes: children,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
  };
}
function root(children) {
  return { childNodes: children };
}

test('reads plain text and bold from the DOM', () => {
  assert.deepEqual(
    domToSegments(root([text('Hello '), el('STRONG', [text('world')])])),
    [{ text: 'Hello ', marks: [] }, { text: 'world', marks: ['bold'] }],
  );
});

test('combines nested inline tags into multiple marks', () => {
  assert.deepEqual(
    domToSegments(root([el('STRONG', [el('EM', [text('x')])])])),
    [{ text: 'x', marks: ['bold', 'italic'] }],
  );
});

test('reads a link href back into segment.link', () => {
  assert.deepEqual(
    domToSegments(root([el('A', [text('go')], { href: 'http://a.com' })])),
    [{ text: 'go', marks: [], link: 'http://a.com' }],
  );
});

test('normalizes adjacent same-format text nodes', () => {
  assert.deepEqual(
    domToSegments(root([text('a'), text('b'), el('EM', [text('c')])])),
    [{ text: 'ab', marks: [] }, { text: 'c', marks: ['italic'] }],
  );
});

test('ignores <br> and maps synonym tags (B/I/DEL) to canonical marks', () => {
  assert.deepEqual(
    domToSegments(root([el('B', [text('x')]), el('BR', []), el('DEL', [text('y')])])),
    [{ text: 'x', marks: ['bold'] }, { text: 'y', marks: ['strikethrough'] }],
  );
});
