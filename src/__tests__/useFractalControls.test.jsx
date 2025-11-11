import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useFractalControls from '../hooks/useFractalControls.js';

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

describe('useFractalControls', () => {
  beforeEach(() => {
    globalThis.requestAnimationFrame = vi.fn(() => 1);
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('exposes default state and toggle handlers', () => {
    const { result } = renderHook(() => useFractalControls());

    const initialType = result.current.fractalType;
    expect(['mandelbrot', 'julia']).toContain(initialType);

    act(() => {
      result.current.handlers.handleFractalToggle();
    });
    expect(result.current.fractalType).not.toBe(initialType);

    const startMutations = result.current.mutationsEnabled;
    act(() => {
      result.current.handlers.handleMutationsToggle();
    });
    expect(result.current.mutationsEnabled).toBe(!startMutations);

    expect(result.current.presetOptions.length).toBeGreaterThan(0);
    const firstPreset = result.current.presetOptions[0];
    act(() => {
      result.current.handlers.handlePresetSelect(firstPreset.name);
    });
    expect(result.current.activePreset).toBe(firstPreset.name);
  });

  it('supports direct palette and Julia seed updates', () => {
    const { result } = renderHook(() => useFractalControls());

    act(() => {
      result.current.handlers.handlePaletteSet(2);
    });
    expect(result.current.paletteIndex).toBe(2);

    act(() => {
      result.current.handlers.handleJuliaSeedSet({ x: 0.18, y: -0.42 });
    });
    expect(result.current.juliaSeed).toEqual({ x: 0.18, y: -0.42 });
  });
});

