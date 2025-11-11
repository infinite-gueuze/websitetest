import { describe, expect, it } from 'vitest';
import {
  buildPaletteLut,
  hexToRgb,
  normalizePaletteContrast,
  relativeLuminance,
} from '../utils/fractalColor.js';

describe('fractal color utilities', () => {
  it('converts hex to rgb', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('computes relative luminance', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
  });

  it('normalizes palette contrast', () => {
    const lut = [
      { r: 10, g: 10, b: 10 },
      { r: 240, g: 240, b: 240 },
    ];
    const normalized = normalizePaletteContrast(lut, 0.5);
    expect(normalized[0].r).toBeLessThan(normalized[1].r);
  });

  it('builds palette LUT with interpolation', () => {
    const lut = buildPaletteLut(['#000000', '#ffffff'], 3);
    expect(lut).toHaveLength(3);
    expect(lut[0].r).toBeLessThan(lut[1].r);
    expect(lut[1].r).toBeLessThan(lut[2].r);
    expect(lut[2].r).toBeLessThanOrEqual(255);
  });
});

