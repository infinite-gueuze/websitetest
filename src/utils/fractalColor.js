import { lerp } from './math.js';
/**
 * Convert a hex color string to RGB channels.
 * @param {string} hex
 * @returns {{ r: number; g: number; b: number }}
 */
export function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);

  if (normalized.length === 3) {
    const r = (bigint >> 8) & 0xf;
    const g = (bigint >> 4) & 0xf;
    const b = bigint & 0xf;
    return {
      r: (r << 4) | r,
      g: (g << 4) | g,
      b: (b << 4) | b,
    };
  }

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Calculate the relative luminance of an RGB color (0-1 range).
 * @param {{ r: number; g: number; b: number }} color
 * @returns {number}
 */
export function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };

  const R = channel(r);
  const G = channel(g);
  const B = channel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Normalise palette luminance so gradients remain vibrant.
 * @param {{ r: number; g: number; b: number }[]} lut
 * @param {number} [minimumRange=0.95]
 * @param {number} [gamma=0.9]
 * @returns {{ r: number; g: number; b: number }[]}
 */
export function normalizePaletteContrast(lut, minimumRange = 0.95, gamma = 0.9) {
  const luminances = lut.map(relativeLuminance);
  const minLum = Math.min(...luminances);
  const maxLum = Math.max(...luminances);
  const range = maxLum - minLum;

  const midLum = (maxLum + minLum) / 2;
  const targetRange = Math.max(minimumRange, range * 1.2);
  const stretch = targetRange / Math.max(range, 1e-6);

  return lut.map((color, index) => {
    const currentLum = luminances[index];
    const targetLum = Math.min(1, Math.max(0, midLum + (currentLum - midLum) * stretch));
    const currentLinear = relativeLuminance(color);

    if (currentLinear === 0) {
      return { r: targetLum * 255, g: targetLum * 255, b: targetLum * 255 };
    }

    const ratio = targetLum / Math.max(currentLinear, 1e-6);
    const remap = (channel) =>
      Math.max(
        0,
        Math.min(
          255,
          255 *
            Math.pow(Math.max(0, Math.min(1, (channel * ratio) / 255)), gamma),
        ),
      );

    return {
      r: remap(color.r),
      g: remap(color.g),
      b: remap(color.b),
    };
  });
}

/**
 * Build a lookup table for a palette interpolated across a range.
 * @param {string[]} colors
 * @param {number} [steps=1024]
 * @returns {{ r: number; g: number; b: number }[]}
 */
export function buildPaletteLut(colors, steps = 1024) {
  const rgb = colors.map(hexToRgb);
  const lut = new Array(steps);

  for (let i = 0; i < steps; i += 1) {
    const position = (i / (steps - 1)) * (rgb.length - 1);
    const index = Math.floor(position);
    const frac = position - index;
    const current = rgb[index];
    const next = rgb[(index + 1) % rgb.length];

    lut[i] = {
      r: lerp(current.r, next.r, frac),
      g: lerp(current.g, next.g, frac),
      b: lerp(current.b, next.b, frac),
    };
  }

  return normalizePaletteContrast(lut);
}

