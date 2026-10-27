/**
 * Daylight — Color Utilities & Accessible Accent Engine
 * Handles hex normalization, sRGB relative luminance, WCAG 2.1 AA contrast calculations,
 * and theme-adaptive CSS custom properties without external dependencies.
 */

export const LIGHT_THEME_DEFAULT_ACCENT = '#48634E';
export const DARK_THEME_DEFAULT_ACCENT = '#8FA893';

export const ACCENT_PRESETS = [
  { name: 'Daylight Sage', hex: '#48634E' },
  { name: 'Ocean Blue', hex: '#2B6CB0' },
  { name: 'Nordic Teal', hex: '#237874' },
  { name: 'Warm Terracotta', hex: '#B85D3B' },
  { name: 'Velvet Plum', hex: '#7B4B74' },
  { name: 'Graphite Slate', hex: '#4A5568' }
];

/**
 * Validates whether input is a valid 6-character hex color (with or without #).
 */
export function isValidHexColor(hex) {
  if (typeof hex !== 'string') return false;
  return /^#?[0-9a-fA-F]{6}$/.test(hex.trim());
}

/**
 * Normalizes valid hex strings to uppercase #RRGGBB.
 * Returns null for invalid values.
 */
export function normalizeHexColor(hex) {
  if (!isValidHexColor(hex)) return null;
  const clean = hex.trim().replace(/^#/, '');
  return `#${clean.toUpperCase()}`;
}

/**
 * Converts a valid hex color string to { r, g, b } (0-255).
 */
export function hexToRgb(hex) {
  const norm = normalizeHexColor(hex);
  if (!norm) return null;
  const clean = norm.slice(1);
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16)
  };
}

/**
 * Converts RGB numbers (0-255) to uppercase #RRGGBB.
 */
export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates sRGB relative luminance according to WCAG 2.1 definition.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B where channels are linearized.
 */
export function getRelativeLuminance(rgb) {
  if (!rgb) return 0;
  const linearize = (val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/**
 * Calculates raw, unrounded WCAG contrast ratio between two colors (hex strings or RGB objects).
 * Returns ratio between 1.0 and 21.0.
 */
export function getRawContrastRatio(color1, color2) {
  const rgb1 = typeof color1 === 'string' ? hexToRgb(color1) : color1;
  const rgb2 = typeof color2 === 'string' ? hexToRgb(color2) : color2;
  if (!rgb1 || !rgb2) return 1.0;

  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculates WCAG contrast ratio between two colors (hex strings or RGB objects).
 * Returns ratio rounded to two decimal places between 1.0 and 21.0.
 */
export function getContrastRatio(color1, color2) {
  const ratio = getRawContrastRatio(color1, color2);
  return Math.round(ratio * 100) / 100;
}

/**
 * Derives a foreground text color for an element filled with accent background.
 * Guarantees optimal readability between white and dark text.
 */
export function getReadableForeground(accentHex) {
  const norm = normalizeHexColor(accentHex) || LIGHT_THEME_DEFAULT_ACCENT;
  const contrastWhite = getRawContrastRatio(norm, '#FFFFFF');
  const contrastDark = getRawContrastRatio(norm, '#141514');

  // If white text passes WCAG AA (4.5:1), prefer white text
  if (contrastWhite >= 4.5) {
    return '#FFFFFF';
  }
  // Otherwise pick whichever provides higher contrast
  return contrastWhite >= contrastDark ? '#FFFFFF' : '#141514';
}

/**
 * Adjusts a color to ensure at least minContrast against a target background color.
 * Uses monotonic linear interpolation (stepping parameter t from 0.01 to 1.0)
 * to darken against light surfaces or lighten against dark surfaces while preserving hue.
 */
export function ensureContrast(colorHex, bgHex, minContrast = 4.5, mode = 'darken') {
  const rgb = hexToRgb(colorHex);
  const bgRgb = hexToRgb(bgHex);
  if (!rgb || !bgRgb) return colorHex;

  // If initial color already satisfies contrast requirement
  if (getRawContrastRatio(rgb, bgRgb) >= minContrast) {
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  const effectiveMode = (mode === 'auto')
    ? (getRelativeLuminance(bgRgb) < 0.5 ? 'lighten' : 'darken')
    : mode;

  // Step monotonic parameter t from 0.01 to 1.0 in 100 discrete steps
  const steps = 100;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    let r, g, b;
    if (effectiveMode === 'darken') {
      r = Math.max(0, Math.round(rgb.r * (1 - t)));
      g = Math.max(0, Math.round(rgb.g * (1 - t)));
      b = Math.max(0, Math.round(rgb.b * (1 - t)));
    } else {
      r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * t));
      g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * t));
      b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * t));
    }
    const candidateRgb = { r, g, b };
    if (getRawContrastRatio(candidateRgb, bgRgb) >= minContrast) {
      return rgbToHex(r, g, b);
    }
  }

  return effectiveMode === 'darken' ? '#141514' : '#FFFFFF';
}

/**
 * Generates the full set of theme-adaptive CSS custom properties
 * for a given accent preference and active theme ('light' or 'dark').
 */
export function generateAccentCssTokens(customAccent, activeTheme = 'light') {
  const isDark = activeTheme === 'dark';
  const defaultAccent = isDark ? DARK_THEME_DEFAULT_ACCENT : LIGHT_THEME_DEFAULT_ACCENT;
  const normalized = normalizeHexColor(customAccent);
  const baseAccent = normalized || defaultAccent;
  const rgb = hexToRgb(baseAccent) || hexToRgb(defaultAccent);

  // Surface background of active theme
  const surfaceBg = isDark ? '#1E1F1E' : '#FFFFFF';
  const pageBg = isDark ? '#141514' : '#F5F4F0';

  // Text color on top of accent fill
  const fg = getReadableForeground(baseAccent);

  // Hover color
  let hoverHex;
  if (isDark) {
    // Lighten hover slightly in dark theme
    hoverHex = rgbToHex(
      Math.min(255, rgb.r + 20),
      Math.min(255, rgb.g + 20),
      Math.min(255, rgb.b + 20)
    );
  } else {
    // Darken hover slightly in light theme
    hoverHex = rgbToHex(
      Math.max(0, rgb.r - 20),
      Math.max(0, rgb.g - 20),
      Math.max(0, rgb.b - 20)
    );
  }

  // Soft translucent fills
  const softAlpha = isDark ? 0.16 : 0.12;
  const softHoverAlpha = isDark ? 0.26 : 0.22;
  const softBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${softAlpha})`;
  const softHoverBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${softHoverAlpha})`;
  const borderSubtle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

  // High-contrast accent for standalone text/icons on page surfaces (WCAG AA >= 4.5:1)
  const accessibleTextAccent = ensureContrast(
    baseAccent,
    surfaceBg,
    4.5,
    isDark ? 'lighten' : 'darken'
  );

  return {
    '--accent': baseAccent,
    '--accent-hover': hoverHex,
    '--accent-text': fg,
    '--accent-soft': softBg,
    '--accent-soft-hover': softHoverBg,
    '--accent-border': borderSubtle,
    '--accent-on-surface': accessibleTextAccent,
    '--accent-focus': baseAccent
  };
}
