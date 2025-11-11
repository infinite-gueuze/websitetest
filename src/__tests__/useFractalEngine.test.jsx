import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useFractalEngine from '../hooks/useFractalEngine.js';
import { createFractalEngine } from '../lib/fractalEngine.js';

const setPaletteSpy = vi.fn();
const updateSettingsSpy = vi.fn();
const destroySpy = vi.fn();

vi.mock('../lib/fractalEngine.js', () => ({
  createFractalEngine: vi.fn(() => ({
    setPalette: setPaletteSpy,
    updateSettings: updateSettingsSpy,
    destroy: destroySpy,
  })),
}));

function EngineHarness({
  paletteData,
  computeRenderPayload,
  onTelemetry,
  minRenderInterval = 4,
  maxDevicePixelRatio = 2,
}) {
  const canvasRef = useRef(null);
  useFractalEngine({
    canvasRef,
    paletteData,
    computeRenderPayload,
    minRenderInterval,
    maxDevicePixelRatio,
    onTelemetry,
  });
  return <canvas ref={canvasRef} data-testid="fractal-canvas" />;
}

describe('useFractalEngine', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('initialises engine, applies palette, and disposes on unmount', async () => {
    const paletteData = { colors: new Float32Array([0, 0, 0]) };
    const computeRenderPayload = vi.fn(() => null);
    const telemetryHandler = vi.fn();

    const { rerender, unmount, getByTestId } = render(
      <EngineHarness
        paletteData={paletteData}
        computeRenderPayload={computeRenderPayload}
        onTelemetry={telemetryHandler}
      />,
    );

    await waitFor(() => expect(createFractalEngine).toHaveBeenCalledTimes(1));

    const canvasElement = getByTestId('fractal-canvas');
    expect(createFractalEngine).toHaveBeenCalledWith(
      canvasElement,
      expect.objectContaining({
        minRenderInterval: 4,
        maxDevicePixelRatio: 2,
        onTelemetry: telemetryHandler,
      }),
    );

    await waitFor(() =>
      expect(updateSettingsSpy).toHaveBeenCalledWith({
        minRenderInterval: 4,
        maxDevicePixelRatio: 2,
      }),
    );

    const nextPalette = { colors: new Float32Array([1, 1, 1]) };
    rerender(
      <EngineHarness
        paletteData={nextPalette}
        computeRenderPayload={computeRenderPayload}
        onTelemetry={telemetryHandler}
      />,
    );

    await waitFor(() => expect(setPaletteSpy).toHaveBeenCalledWith(nextPalette.colors));

    const nextTelemetry = vi.fn();
    rerender(
      <EngineHarness
        paletteData={nextPalette}
        computeRenderPayload={computeRenderPayload}
        onTelemetry={nextTelemetry}
      />,
    );

    await waitFor(() =>
      expect(updateSettingsSpy).toHaveBeenCalledWith({
        onTelemetry: nextTelemetry,
      }),
    );

    const nextCompute = vi.fn(() => null);
    rerender(
      <EngineHarness
        paletteData={nextPalette}
        computeRenderPayload={nextCompute}
        onTelemetry={nextTelemetry}
      />,
    );

    await waitFor(() =>
      expect(updateSettingsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          computeRenderPayload: expect.any(Function),
        }),
      ),
    );

    unmount();
    expect(destroySpy).toHaveBeenCalled();
  });
});

