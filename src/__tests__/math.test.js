import { describe, expect, it, vi } from 'vitest';
import { clamp, lerp, pickFrom, randomRange } from '../utils/math.js';

describe('math utilities', () => {
  it('lerp interpolates linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(-5, 5, 0.75)).toBe(2.5);
  });

  it('clamp restricts values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('randomRange uses provided rng', () => {
    const mockRandom = vi.fn().mockReturnValue(0.25);
    expect(randomRange(0, 100, mockRandom)).toBe(25);
  });

  it('pickFrom selects deterministic value with custom rng', () => {
    const mockRandom = vi.fn().mockReturnValue(0.6);
    const result = pickFrom(['a', 'b', 'c', 'd'], mockRandom);
    expect(result).toBe('c');
    expect(mockRandom).toHaveBeenCalledTimes(1);
  });

  it('pickFrom throws on empty array', () => {
    expect(() => pickFrom([])).toThrow(/empty array/i);
  });
});

