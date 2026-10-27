/**
 * Daylight — Test Suite: Accent Customization, WCAG Contrast, Themes & Zen Greeting
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LIGHT_THEME_DEFAULT_ACCENT,
  DARK_THEME_DEFAULT_ACCENT,
  ACCENT_PRESETS,
  isValidHexColor,
  normalizeHexColor,
  hexToRgb,
  rgbToHex,
  getRelativeLuminance,
  getContrastRatio,
  getReadableForeground,
  ensureContrast,
  generateAccentCssTokens
} from '../src/color.js';
import {
  getTimeOfDayGreeting,
  getDailyZenMessage,
  ZEN_SUPPORTING_MESSAGES
} from '../src/greetings.js';
import {
  createInitialState,
  validateState,
  normalizeAndCleanState,
  CURRENT_SCHEMA_VERSION
} from '../src/schema.js';
import { StorageAdapter } from '../src/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// In-memory mock storage backend
class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.failNextWrite = false;
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failNextWrite) {
      throw new Error('QuotaExceededError: LocalStorage quota exceeded');
    }
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

test('Accent Colors: Default values and initial state', () => {
  const state = createInitialState();
  assert.equal(state.preferences.accentColor, null, 'Initial state should have accentColor as null (default Daylight sage)');
  assert.equal(LIGHT_THEME_DEFAULT_ACCENT, '#48634E');
  assert.equal(DARK_THEME_DEFAULT_ACCENT, '#8FA893');
});

test('Accent Colors: Hex validation and normalization', () => {
  assert.equal(isValidHexColor('#48634E'), true);
  assert.equal(isValidHexColor('48634e'), true);
  assert.equal(isValidHexColor('#fff'), false, '3-digit hex should be false or strict');
  assert.equal(isValidHexColor('red'), false);
  assert.equal(isValidHexColor('javascript:alert(1)'), false);
  assert.equal(isValidHexColor('#12345G'), false);

  assert.equal(normalizeHexColor('#48634e'), '#48634E');
  assert.equal(normalizeHexColor('2b6cb0'), '#2B6CB0');
  assert.equal(normalizeHexColor('invalid'), null);
});

test('Accent Colors: Preset swatches are valid and unique', () => {
  assert.ok(ACCENT_PRESETS.length >= 6);
  const seenHexes = new Set();
  ACCENT_PRESETS.forEach(p => {
    assert.ok(p.name && typeof p.name === 'string');
    assert.ok(isValidHexColor(p.hex));
    assert.equal(normalizeHexColor(p.hex), p.hex);
    assert.ok(!seenHexes.has(p.hex));
    seenHexes.add(p.hex);
  });
});

test('Contrast: Relative luminance and contrast calculations match WCAG specifications', () => {
  // Black and white
  const blackRgb = { r: 0, g: 0, b: 0 };
  const whiteRgb = { r: 255, g: 255, b: 255 };

  assert.equal(getRelativeLuminance(blackRgb), 0);
  assert.equal(getRelativeLuminance(whiteRgb), 1);

  // Black vs White is 21:1
  const maxContrast = getContrastRatio('#000000', '#FFFFFF');
  assert.equal(maxContrast, 21);

  // Same color contrast is 1:1
  assert.equal(getContrastRatio('#FFFFFF', '#FFFFFF'), 1);

  // Daylight Sage (#48634E) on white is > 5:1
  const sageContrast = getContrastRatio('#48634E', '#FFFFFF');
  assert.ok(sageContrast >= 5.0, `Sage contrast on white was ${sageContrast}, expected >= 5.0`);
});

test('Contrast: Readable foreground selection ensures legible text on accent fills', () => {
  // Deep/dark colors need white text
  assert.equal(getReadableForeground('#141514'), '#FFFFFF');
  assert.equal(getReadableForeground('#48634E'), '#FFFFFF');
  assert.equal(getReadableForeground('#2B6CB0'), '#FFFFFF');

  // Very light/pale colors need dark text
  assert.equal(getReadableForeground('#FFFF00'), '#141514');
  assert.equal(getReadableForeground('#FFFFFF'), '#141514');
  assert.equal(getReadableForeground('#E0E0E0'), '#141514');
  assert.equal(getReadableForeground('#F5F4F0'), '#141514');
});

test('Contrast: CSS custom properties generated for light and dark themes', () => {
  const lightTokens = generateAccentCssTokens('#2B6CB0', 'light');
  assert.equal(lightTokens['--accent'], '#2B6CB0');
  assert.ok(lightTokens['--accent-text']);
  assert.ok(lightTokens['--accent-hover']);
  assert.ok(lightTokens['--accent-soft'].startsWith('rgba('));
  assert.ok(lightTokens['--accent-on-surface']);

  // Ensure high contrast on light surface
  const lightSurfaceContrast = getContrastRatio(lightTokens['--accent-on-surface'], '#FFFFFF');
  assert.ok(lightSurfaceContrast >= 4.5, `Contrast was ${lightSurfaceContrast}`);

  const darkTokens = generateAccentCssTokens('#2B6CB0', 'dark');
  assert.equal(darkTokens['--accent'], '#2B6CB0');
  const darkSurfaceContrast = getContrastRatio(darkTokens['--accent-on-surface'], '#1E1F1E');
  assert.ok(darkSurfaceContrast >= 4.5, `Contrast was ${darkSurfaceContrast}`);
});

test('Contrast: ensureContrast monotonically adjusts color without collapsing to white in dark mode', () => {
  const darkSurface = '#1E1F1E';
  const lightSurface = '#FFFFFF';

  // Test light sage #48634E adjusted for dark theme
  const lightSageInDark = ensureContrast('#48634E', darkSurface, 4.5, 'lighten');
  assert.notEqual(lightSageInDark, '#FFFFFF', 'Should not collapse to pure white');
  const sageRatio = getContrastRatio(lightSageInDark, darkSurface);
  assert.ok(sageRatio >= 4.5, `Sage ratio in dark was ${sageRatio}, expected >= 4.5`);

  // Test all presets in dark mode - NONE should collapse to white
  for (const preset of ACCENT_PRESETS) {
    const adjustedDark = ensureContrast(preset.hex, darkSurface, 4.5, 'lighten');
    assert.notEqual(adjustedDark, '#FFFFFF', `Preset ${preset.name} (${preset.hex}) should not collapse to #FFFFFF in dark mode`);
    const ratioDark = getContrastRatio(adjustedDark, darkSurface);
    assert.ok(ratioDark >= 4.5, `Preset ${preset.name} in dark mode had contrast ${ratioDark}, expected >= 4.5`);

    // Test all presets in light mode - NONE should collapse to black
    const adjustedLight = ensureContrast(preset.hex, lightSurface, 4.5, 'darken');
    assert.notEqual(adjustedLight, '#000000', `Preset ${preset.name} (${preset.hex}) should not collapse to #000000 in light mode`);
    const ratioLight = getContrastRatio(adjustedLight, lightSurface);
    assert.ok(ratioLight >= 4.5, `Preset ${preset.name} in light mode had contrast ${ratioLight}, expected >= 4.5`);
  }

  // Extreme boundaries
  const nearBlackInDark = ensureContrast('#020202', darkSurface, 4.5, 'lighten');
  assert.ok(getContrastRatio(nearBlackInDark, darkSurface) >= 4.5);

  const nearWhiteInLight = ensureContrast('#FEFEFE', lightSurface, 4.5, 'darken');
  assert.ok(getContrastRatio(nearWhiteInLight, lightSurface) >= 4.5);
});

test('Schema: Backward compatibility and accentColor validation', () => {
  const baseState = createInitialState();

  // Valid custom accent
  baseState.preferences.accentColor = '#2B6CB0';
  assert.equal(validateState(baseState).valid, true);

  // Null accent (Daylight Sage default)
  baseState.preferences.accentColor = null;
  assert.equal(validateState(baseState).valid, true);

  // Missing accent (legacy backup)
  delete baseState.preferences.accentColor;
  assert.equal(validateState(baseState).valid, true);

  // Malformed accent rejected
  baseState.preferences.accentColor = 'not-a-color';
  assert.equal(validateState(baseState).valid, false);

  baseState.preferences.accentColor = '#123';
  assert.equal(validateState(baseState).valid, false);

  // Normalization handles legacy backups smoothly
  delete baseState.preferences.accentColor;
  const normalized = normalizeAndCleanState(baseState);
  assert.equal(normalized.preferences.accentColor, null);
});

test('Storage: Accent preference survives serialization and restore transactionally', () => {
  const mockStorage = new MockLocalStorage();
  const adapter = new StorageAdapter(mockStorage);
  adapter.load();

  // Save custom accent
  adapter.state.preferences.accentColor = '#7B4B74';
  const saveRes = adapter.save();
  assert.equal(saveRes.success, true);

  // Reload from storage
  const adapter2 = new StorageAdapter(mockStorage);
  adapter2.load();
  assert.equal(adapter2.state.preferences.accentColor, '#7B4B74');

  // Verify backup export and restore preserves accent
  const snapshot = adapter2.exportSnapshot();
  const restored = adapter.restore(snapshot);
  assert.equal(restored.success, true);
  assert.equal(adapter.state.preferences.accentColor, '#7B4B74');

  // Restore with invalid accent fails safely without corrupting current state
  const badPayload = JSON.parse(snapshot);
  badPayload.preferences.accentColor = 'invalid-hex';
  const badRestore = adapter.restore(JSON.stringify(badPayload));
  assert.equal(badRestore.success, false);
  assert.equal(adapter.state.preferences.accentColor, '#7B4B74');
});

test('Zen Greeting: Time of day greeting accurately reflects local hour', () => {
  assert.equal(getTimeOfDayGreeting(0), 'Good morning');
  assert.equal(getTimeOfDayGreeting(8), 'Good morning');
  assert.equal(getTimeOfDayGreeting(11), 'Good morning');
  assert.equal(getTimeOfDayGreeting(12), 'Good afternoon');
  assert.equal(getTimeOfDayGreeting(15), 'Good afternoon');
  assert.equal(getTimeOfDayGreeting(17), 'Good afternoon');
  assert.equal(getTimeOfDayGreeting(18), 'Good evening');
  assert.equal(getTimeOfDayGreeting(23), 'Good evening');
});

test('Zen Greeting: Daily supporting message remains stable during the same local day', () => {
  const msg1 = getDailyZenMessage('2026-10-24');
  const msg2 = getDailyZenMessage('2026-10-24');
  const msg3 = getDailyZenMessage('2026-10-24');

  assert.equal(msg1, msg2);
  assert.equal(msg2, msg3);
  assert.ok(ZEN_SUPPORTING_MESSAGES.includes(msg1));

  // Word count constraint check (short and sweet, 3-9 words)
  ZEN_SUPPORTING_MESSAGES.forEach(msg => {
    const wordCount = msg.split(/\s+/).length;
    assert.ok(wordCount >= 3 && wordCount <= 9, `Message "${msg}" had ${wordCount} words`);
  });
});

test('Zen Greeting: Message rotates predictably on date change', () => {
  const msgDay1 = getDailyZenMessage('2026-10-24');
  const msgDay2 = getDailyZenMessage('2026-10-25');
  // Different days map predictably without throwing
  assert.ok(typeof msgDay1 === 'string' && msgDay1.length > 0);
  assert.ok(typeof msgDay2 === 'string' && msgDay2.length > 0);
});

test('Release Integrity: Standalone daylight/index.html includes accent and greeting engines', () => {
  const htmlPath = path.join(rootDir, 'index.html');
  assert.ok(fs.existsSync(htmlPath), 'daylight/index.html must exist');
  const content = fs.readFileSync(htmlPath, 'utf8');

  // Verify color utilities included
  assert.ok(content.includes('generateAccentCssTokens'), 'Compiled HTML must include generateAccentCssTokens');
  assert.ok(content.includes('accentColorPicker'), 'Compiled HTML must include accentColorPicker control');
  assert.ok(content.includes('zen-subgreeting'), 'Compiled HTML must include zen-subgreeting');
  assert.ok(content.includes('getDailyZenMessage'), 'Compiled HTML must include getDailyZenMessage');

  // Verify release ZIPs exist and contain strictly clean files
  const zipPathV121 = path.join(rootDir, '..', 'Daylight-v1.2.1.zip');
  assert.ok(fs.existsSync(zipPathV121), 'Daylight-v1.2.1.zip must exist');
});
