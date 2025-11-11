import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFractalEngine } from '../lib/fractalEngine.js';

class MockWorker {
  constructor() {
    this.listeners = new Map();
    this.messages = [];
    this.terminated = false;
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(type, data) {
    const handler = this.listeners.get(type);
    if (handler) {
      handler({ data });
    }
  }
}

class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {
    // no-op for tests
  }

  disconnect() {
    // no-op for tests
  }
}

describe('fractal engine', () => {
  let rafCallback;
  let engine;
  let worker;
  let canvas;
  let putImageData;
  let telemetrySpy;
  let now;
  let originalImageData;

  beforeAll(() => {
    originalImageData = globalThis.ImageData;
    globalThis.ImageData = class {
      constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    };
  });

  afterAll(() => {
    if (originalImageData) {
      globalThis.ImageData = originalImageData;
    } else {
      delete globalThis.ImageData;
    }
  });
  beforeEach(() => {
    rafCallback = null;
    putImageData = vi.fn();
    telemetrySpy = vi.fn();
    worker = new MockWorker();
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ putImageData })),
      getBoundingClientRect: () => ({ width: 320, height: 200 }),
    };
    now = 0;
  });

  afterEach(() => {
    engine?.destroy();
  });

  function requestAnimationFrame(callback) {
    rafCallback = callback;
    return 1;
  }

  function cancelAnimationFrame() {
    rafCallback = null;
  }

  function advanceFrame(delta = 16) {
    if (typeof rafCallback === 'function') {
      now += delta;
      const cb = rafCallback;
      rafCallback = null;
      cb(now);
    } else {
      throw new Error('No RAF callback registered');
    }
  }

  it('sends render payloads and draws worker results', () => {
    const computeRenderPayload = vi.fn(() => ({
      fractalType: 'mandelbrot',
      fractalVariant: 'classic',
      maxIterations: 100,
      view: { centerX: 0, centerY: 0, scale: 1, aspectRatio: 0.5 },
    }));

    engine = createFractalEngine(canvas, {
      minRenderInterval: 0,
      computeRenderPayload,
      createWorker: () => worker,
      ResizeObserver: MockResizeObserver,
      requestAnimationFrame,
      cancelAnimationFrame,
      getDevicePixelRatio: () => 1,
      onTelemetry: telemetrySpy,
      onDraw: (context, imageData) => {
        context.putImageData(imageData, 0, 0);
      },
    });

    expect(canvas.getContext).toHaveBeenCalled();
    expect(typeof rafCallback).toBe('function');

    advanceFrame(16);

    expect(computeRenderPayload).toHaveBeenCalledTimes(1);
    expect(worker.messages.at(-1)).toMatchObject({ type: 'render', width: 320, height: 200 });

    const buffer = new Uint8ClampedArray(320 * 200 * 4);
    worker.emit('message', {
      type: 'render-result',
      width: 320,
      height: 200,
      buffer: buffer.buffer,
    });

    expect(putImageData).toHaveBeenCalledTimes(1);
    expect(telemetrySpy).toHaveBeenCalled();
  });

  it('pushes palette updates before renders', () => {
    const computeRenderPayload = vi.fn(() => ({
      fractalType: 'mandelbrot',
      maxIterations: 10,
      view: { centerX: 0, centerY: 0, scale: 1, aspectRatio: 1 },
    }));

    engine = createFractalEngine(canvas, {
      minRenderInterval: 0,
      computeRenderPayload,
      createWorker: () => worker,
      ResizeObserver: MockResizeObserver,
      requestAnimationFrame,
      cancelAnimationFrame,
      getDevicePixelRatio: () => 1,
    });

    const palette = new Float32Array([0, 0, 0, 255, 255, 255]);
    engine.setPalette(palette);

    advanceFrame(16);

    expect(worker.messages[0]).toMatchObject({ type: 'set-palette' });
    expect(worker.messages[1]).toMatchObject({ type: 'render' });
  });

  it('updates settings without recreating the engine', () => {
    const initialPayload = vi.fn(() => null);
    telemetrySpy.mockReset();

    engine = createFractalEngine(canvas, {
      minRenderInterval: 12,
      maxDevicePixelRatio: 1,
      computeRenderPayload: initialPayload,
      createWorker: () => worker,
      ResizeObserver: MockResizeObserver,
      requestAnimationFrame,
      cancelAnimationFrame,
      getDevicePixelRatio: () => 1,
    });

    const nextPayload = vi.fn(() => ({
      fractalType: 'mandelbrot',
      maxIterations: 120,
      view: { centerX: 0, centerY: 0, scale: 1, aspectRatio: 1 },
    }));

    engine.options.getDevicePixelRatio = () => 2;

    engine.updateSettings({
      minRenderInterval: 0,
      maxDevicePixelRatio: 2,
      computeRenderPayload: nextPayload,
      onTelemetry: telemetrySpy,
    });

    expect(engine.options.minRenderInterval).toBe(0);
    expect(engine.options.maxDevicePixelRatio).toBe(2);

    advanceFrame(16);

    expect(nextPayload).toHaveBeenCalled();
    expect(canvas.width).toBe(640);
    expect(telemetrySpy).toHaveBeenCalled();
  });
});

