import assert from 'node:assert/strict';
import test from 'node:test';
import { STYLE_GROUPS, stylesOf } from './playback-policy.mjs';

test('FPV and UA remain independently selectable while UA also joins Ukrainian', () => {
  assert.deepEqual(STYLE_GROUPS.slice(0, 2), [['fpv', 'ФПВ'], ['ua', 'UA']]);
  assert.deepEqual(stylesOf({ tags: ['ФПВ', 'UA'] }), ['fpv', 'ua', 'ukrainian']);
  assert.deepEqual(stylesOf({ tags: ['Ukrainian', 'Metal'] }), ['ukrainian', 'metal']);
});
