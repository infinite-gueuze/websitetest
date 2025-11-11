import { useEffect, useRef } from 'react';
import { createFractalEngine } from '../lib/fractalEngine.js';

export function useFractalEngine({
  canvasRef,
  paletteData,
  computeRenderPayload,
  minRenderInterval,
  maxDevicePixelRatio,
  onTelemetry,
}) {
  const engineRef = useRef(null);
  const renderCallbackRef = useRef(computeRenderPayload);
  const telemetryRef = useRef(onTelemetry ?? null);
  const minRenderIntervalRef = useRef(minRenderInterval);
  const maxDevicePixelRatioRef = useRef(maxDevicePixelRatio);
  const paletteRef = useRef(paletteData);

  useEffect(() => {
    renderCallbackRef.current = computeRenderPayload;
    const engine = engineRef.current;
    if (engine) {
      engine.updateSettings({
        computeRenderPayload: (frame) =>
          renderCallbackRef.current?.({
            deltaSeconds: frame.deltaSeconds,
            deltaMs: frame.deltaMs,
            width: frame.width,
            height: frame.height,
          }) ?? null,
      });
    }
  }, [computeRenderPayload]);

  useEffect(() => {
    telemetryRef.current = onTelemetry ?? null;
    const engine = engineRef.current;
    if (engine) {
      engine.updateSettings({
        onTelemetry: telemetryRef.current,
      });
    }
  }, [onTelemetry]);

  useEffect(() => {
    minRenderIntervalRef.current = minRenderInterval;
  }, [minRenderInterval]);

  useEffect(() => {
    maxDevicePixelRatioRef.current = maxDevicePixelRatio;
  }, [maxDevicePixelRatio]);

  useEffect(() => {
    paletteRef.current = paletteData;
  }, [paletteData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const computePayload = (frame) =>
      renderCallbackRef.current?.({
        deltaSeconds: frame.deltaSeconds,
        deltaMs: frame.deltaMs,
        width: frame.width,
        height: frame.height,
      }) ?? null;

    const engine = createFractalEngine(canvas, {
      minRenderInterval: minRenderIntervalRef.current,
      maxDevicePixelRatio: maxDevicePixelRatioRef.current,
      computeRenderPayload: computePayload,
      onTelemetry: telemetryRef.current ?? undefined,
    });

    engineRef.current = engine;

    const initialPalette = paletteRef.current;
    if (initialPalette?.colors) {
      engine.setPalette(initialPalette.colors);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [canvasRef]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }
    engine.updateSettings({
      minRenderInterval,
      maxDevicePixelRatio,
    });
  }, [minRenderInterval, maxDevicePixelRatio]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !paletteData?.colors) {
      return;
    }
    engine.setPalette(paletteData.colors);
  }, [paletteData]);

  return engineRef;
}

export default useFractalEngine;

