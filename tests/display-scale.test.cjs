const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeChoice, resolveDisplay } = require('../display-scale.js');

test('only explicit supported scale preferences are restored from storage', () => {
  for (const choice of ['auto', '100', '125', '150', '175', '200', '250']) {
    assert.equal(normalizeChoice(choice), choice);
  }
  for (const choice of [undefined, null, '', 'AUTO', '50', '175%', '999999', '1.5', 200, true, {}, NaN]) {
    assert.equal(normalizeChoice(choice), 'auto');
  }
});

test('Auto enlarges a 2880 CSS pixel viewport to a usable 1440 pixel layout', () => {
  const display = resolveDisplay(2880, 1620, 'auto');
  assert.equal(display.choice, 'auto');
  assert.equal(display.scale, 2);
  assert.equal(display.viewportWidth, 2880);
  assert.equal(display.width, 1440);
  assert.equal(display.height, 810);
  assert.equal(display.stacked, false);
  assert.equal(display.phone, false);
});

test('Auto scales 1920 moderately and does not shrink a 1280 viewport', () => {
  const large = resolveDisplay(1920, 1080, 'auto');
  assert.ok(large.scale > 1.3 && large.scale < 1.35);
  assert.ok(Math.abs(large.width - 1440) < 2, 'Auto should aim near the intended layout width');
  assert.ok(Math.abs(large.height - 810) < 2);
  const smaller = resolveDisplay(1280, 720, 'auto');
  assert.equal(smaller.scale, 1);
  assert.equal(smaller.width, 1280);
  assert.equal(smaller.height, 720);
});

test('Auto is capped on exceptionally wide viewports', () => {
  const display = resolveDisplay(7680, 2160, 'auto');
  assert.equal(display.scale, 2.5);
  assert.equal(display.width, 3072);
  assert.equal(display.height, 864);
});

test('changing fullscreen height preserves a manual preference and its horizontal layout', () => {
  const heights = [720, 940, 960, 1080, 1620];
  const layouts = heights.map(height => resolveDisplay(1920, height, '175'));
  for (let index = 0; index < layouts.length; index++) {
    const display = layouts[index];
    assert.equal(display.choice, '175');
    assert.equal(display.scale, 1.75);
    assert.equal(display.width, layouts[0].width);
    assert.equal(display.small, layouts[0].small);
    assert.equal(display.stacked, layouts[0].stacked);
    assert.equal(display.height, heights[index] / 1.75);
  }
});

test('Auto responds to viewport width rather than the fullscreen height boundary', () => {
  const before = resolveDisplay(2880, 940, 'auto');
  const after = resolveDisplay(2880, 1620, 'auto');
  assert.equal(before.scale, after.scale);
  assert.equal(before.width, after.width);
  assert.notEqual(before.height, after.height);
});

test('supported manual choices represent exact magnification rather than changing with width', () => {
  for (const choice of ['100', '125', '150', '175', '200', '250']) {
    const display = resolveDisplay(2880, 1620, choice);
    assert.equal(display.choice, choice);
    assert.equal(display.scale, Number(choice) / 100);
    assert.equal(display.width * display.scale, 2880);
    assert.equal(display.height * display.scale, 1620);
  }
});

test('unsafe manual magnification resets the active choice to Auto on a phone', () => {
  for (const choice of ['125', '150', '175', '200', '250']) {
    const display = resolveDisplay(390, 844, choice);
    assert.equal(display.choice, 'auto');
    assert.equal(display.scale, 1);
    assert.equal(display.width, 390);
    assert.equal(display.phone, true);
    assert.equal(display.stacked, true);
    assert.equal(display['diagnostics-stacked'], true);
  }
  const narrow = resolveDisplay(320, 568, '250');
  assert.equal(narrow.choice, 'auto');
  assert.equal(narrow.scale, 1, 'Auto must not shrink a narrow phone further');
});

test('the 360 effective pixel usability boundary is inclusive', () => {
  const valid = resolveDisplay(720, 1280, '200');
  assert.equal(valid.choice, '200');
  assert.equal(valid.width, 360);
  const invalid = resolveDisplay(719, 1280, '200');
  assert.equal(invalid.choice, 'auto');
  assert.equal(invalid.scale, 1);
});

test('effective width, not raw viewport width, selects every responsive breakpoint', () => {
  const boundaries = [
    ['small', 1150],
    ['diagnostics-stacked', 1050],
    ['stacked', 920],
    ['phone', 620]
  ];
  for (const [flag, width] of boundaries) {
    const atBoundary = resolveDisplay(width * 2, 1440, '200');
    const aboveBoundary = resolveDisplay((width + 1) * 2, 1440, '200');
    assert.equal(atBoundary[flag], true, `${flag} must apply at ${width} effective pixels`);
    assert.equal(aboveBoundary[flag], false, `${flag} must stop above its effective breakpoint`);
  }
  const zoomed = resolveDisplay(1280, 720, '200');
  assert.equal(zoomed.width, 640);
  assert.equal(zoomed.stacked, true, 'two native players must not be squeezed into a raw-desktop viewport');
  assert.equal(zoomed['diagnostics-stacked'], true);
  assert.equal(zoomed.phone, false);
});

test('invalid stored preferences use Auto without producing NaN geometry', () => {
  const expected = resolveDisplay(2880, 1620, 'auto');
  for (const choice of [null, undefined, 'broken', '500', 'Infinity', {}, 150]) {
    assert.deepEqual(resolveDisplay(2880, 1620, choice), expected);
  }
});

test('invalid viewport metrics fall back independently to finite positive geometry', () => {
  for (const value of [undefined, null, '', '1920', false, NaN, Infinity, -Infinity, 0, -1]) {
    const invalidWidth = resolveDisplay(value, 720, '100');
    assert.equal(invalidWidth.viewportWidth, 1440);
    assert.equal(invalidWidth.width, 1440);
    assert.equal(invalidWidth.height, 720);
    const invalidHeight = resolveDisplay(1920, value, '100');
    assert.equal(invalidHeight.viewportWidth, 1920);
    assert.equal(invalidHeight.width, 1920);
    assert.equal(invalidHeight.height, 900);
    for (const display of [invalidWidth, invalidHeight]) {
      assert.ok(Number.isFinite(display.scale) && display.scale > 0);
      assert.ok(Number.isFinite(display.width) && display.width > 0);
      assert.ok(Number.isFinite(display.height) && display.height > 0);
    }
  }
});
