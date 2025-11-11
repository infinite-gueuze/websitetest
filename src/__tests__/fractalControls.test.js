import { describe, expect, it } from 'vitest';
import {
  autoZoomSpeedToPercent,
  formatVariantLabel,
  percentToAutoZoomSpeed,
  pickFocusTarget,
  pickSceneDefinition,
  randomJuliaSeed,
} from '../utils/fractalControls.js';

describe('fractal control utilities', () => {
  it('pickSceneDefinition excludes the provided name', () => {
    const scenes = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
    ];
    const rng = () => 0;
    const result = pickSceneDefinition('a', scenes, rng);
    expect(result.name).not.toBe('a');
  });

  it('pickFocusTarget returns jittered focus coordinates', () => {
    const focusPresets = {
      mandelbrot: {
        classic: [
          { scale: 1, center: { x: 1, y: 1 } },
          { scale: 0.5, center: { x: 2, y: 2 } },
        ],
      },
    };
    const rng = () => 0.5; // center jitter cancels out
    const result = pickFocusTarget('mandelbrot', 'classic', 0.4, focusPresets, rng);
    expect(result).toEqual({ x: 2, y: 2 });
  });

  it('randomJuliaSeed uses injected rng for determinism', () => {
    const rng = () => 0;
    const seed = randomJuliaSeed(rng);
    expect(seed).toEqual({ x: 0.6, y: 0 });
  });

  it('auto zoom conversions round-trip correctly', () => {
    const percent = autoZoomSpeedToPercent(0.01);
    const speed = percentToAutoZoomSpeed(percent);
    expect(speed).toBeCloseTo(0.01, 6);
  });

  it('formatVariantLabel prettifies names', () => {
    expect(formatVariantLabel('burning-ship')).toBe('burning ship');
    expect(formatVariantLabel('classic')).toBe('classic');
  });
});

