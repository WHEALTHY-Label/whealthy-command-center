import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256, stableJson } from '../lib/manifest.mjs';

test('stableJson sorts object keys recursively', () => {
  assert.equal(stableJson({ z: 1, a: { y: 2, b: 3 } }), '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "z": 1\n}\n');
});

test('sha256 returns a lowercase 64-character digest', () => {
  assert.equal(sha256('whealthy'), 'c823f951e8b87fd5d91b3854912644fa5ac8ac2d63f0a29e05a7d9e85e9751fa');
});
