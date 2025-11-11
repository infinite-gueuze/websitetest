import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useAiFractalCurator from '../hooks/useAiFractalCurator.js';

const baseState = Object.freeze({
  fractalType: 'mandelbrot',
  fractalVariant: 'classic',
  paletteIndex: 0,
  juliaSeed: { x: 0.33, y: -0.12 },
  autoZoomPercent: 42,
  autoZoomDirection: -1,
  mutationsEnabled: true,
  activePreset: 'deep-dive',
  statusMessage: 'Initial',
});

describe('useAiFractalCurator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns AI directive when the client resolves successfully', async () => {
    const directive = {
      paletteIndex: 3,
      autoZoomPercent: 58,
      statusMessage: 'AI shift',
    };
    const client = {
      requestDirective: vi.fn().mockResolvedValue(directive),
    };

    const { result } = renderHook(() =>
      useAiFractalCurator({
        isEnabled: false,
        currentState: baseState,
        aiClient: client,
        autoCadenceMs: 10_000,
      }),
    );

    await act(async () => {
      await result.current.requestSuggestion({ reschedule: false });
    });

    expect(client.requestDirective).toHaveBeenCalledTimes(1);
    expect(result.current.lastDirective).toMatchObject({
      paletteIndex: directive.paletteIndex,
      statusMessage: directive.statusMessage,
    });
    expect(result.current.lastDirective.autoZoomPercent).toBeUndefined();
    expect(result.current.lastDirective.cadenceMs).toBeGreaterThanOrEqual(15_000);
    expect(result.current.lastSource).toBe('ai');
    expect(result.current.error).toBeNull();
  });

  it('falls back to deterministic directive when AI fails', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const client = {
      requestDirective: vi.fn().mockRejectedValue(new Error('network down')),
    };

    const { result } = renderHook(() =>
      useAiFractalCurator({
        isEnabled: false,
        currentState: baseState,
        aiClient: client,
        autoCadenceMs: 10_000,
      }),
    );

    await act(async () => {
      await result.current.requestSuggestion({ reschedule: false });
    });

    expect(client.requestDirective).toHaveBeenCalledTimes(1);
    expect(result.current.lastSource).toBe('fallback');
    expect(result.current.lastDirective).toMatchObject({
      fractalType: baseState.fractalType,
    });
    expect(result.current.lastDirective.cadenceMs).toBeGreaterThanOrEqual(15_000);
    expect(result.current.error).toBeTruthy();
  });
});

