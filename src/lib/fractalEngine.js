import { FRACTAL_CONSTANTS } from '../config/fractalSettings.js';

/**
 * @typedef {Object} FractalFrameContext
 * @property {number} timestamp
 * @property {number} deltaMs
 * @property {number} deltaSeconds
 * @property {HTMLCanvasElement} canvas
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} FractalRenderPayload
 * @property {'mandelbrot'|'julia'} fractalType
 * @property {string} [fractalVariant]
 * @property {{ x: number; y: number }} [juliaSeed]
 * @property {number} maxIterations
 * @property {{ centerX: number; centerY: number; scale: number; aspectRatio: number }} view
 */

/**
 * @typedef {Object} FractalTelemetry
 * @property {number} fps
 * @property {number} frameTimeMs
 * @property {number} totalFrames
 */

/**
 * @typedef {Object} FractalEngineOptions
 * @property {number} [minRenderInterval]
 * @property {number} [maxDevicePixelRatio]
 * @property {(frame: FractalFrameContext) => (FractalRenderPayload|null|undefined)} [computeRenderPayload]
 * @property {(telemetry: FractalTelemetry) => void} [onTelemetry]
 * @property {(message: any) => void} [onWorkerMessage]
 * @property {(context: CanvasRenderingContext2D, imageData: ImageData) => void} [onDraw]
 * @property {ResizeObserver} [ResizeObserver]
 * @property {() => Worker} [createWorker]
 * @property {(callback: FrameRequestCallback) => number} [requestAnimationFrame]
 * @property {(handle: number) => void} [cancelAnimationFrame]
 * @property {() => number} [getDevicePixelRatio]
 * @property {(preset: string) => void} [onApplyPreset]
 */

const DEFAULT_MIN_INTERVAL = FRACTAL_CONSTANTS.MIN_RENDER_INTERVAL;
const DEFAULT_MAX_DPR = FRACTAL_CONSTANTS.MAX_DEVICE_PIXEL_RATIO;

/**
 * Internal helper to resolve the device pixel ratio with a safe fallback.
 * @param {() => number} provider
 * @returns {number}
 */
function resolveDevicePixelRatio(provider) {
  try {
    return provider();
  } catch (error) {
    console.warn('[fractalEngine] Unable to read devicePixelRatio:', error);
    return 1;
  }
}

class FractalEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {FractalEngineOptions} options
   */
  constructor(canvas, options = {}) {
    if (!canvas) {
      throw new Error('createFractalEngine requires a canvas element.');
    }

    const globalThisRef = typeof window !== 'undefined' ? window : globalThis;

    this.canvas = canvas;
    this.options = {
      minRenderInterval: options.minRenderInterval ?? DEFAULT_MIN_INTERVAL,
      maxDevicePixelRatio: options.maxDevicePixelRatio ?? DEFAULT_MAX_DPR,
      computeRenderPayload: options.computeRenderPayload ?? null,
      onTelemetry: options.onTelemetry ?? null,
      onWorkerMessage: options.onWorkerMessage ?? null,
      onDraw: options.onDraw ?? null,
      onApplyPreset: options.onApplyPreset ?? null,
      ResizeObserver: options.ResizeObserver ?? globalThisRef?.ResizeObserver ?? null,
      createWorker:
        options.createWorker ??
        (() => new Worker(new URL('../workers/fractalWorker.js', import.meta.url), { type: 'module' })),
      requestAnimationFrame: options.requestAnimationFrame ?? globalThisRef?.requestAnimationFrame?.bind(globalThisRef),
      cancelAnimationFrame: options.cancelAnimationFrame ?? globalThisRef?.cancelAnimationFrame?.bind(globalThisRef),
      getDevicePixelRatio: options.getDevicePixelRatio ?? (() => globalThisRef?.devicePixelRatio ?? 1),
    };

    if (!this.options.requestAnimationFrame || !this.options.cancelAnimationFrame) {
      throw new Error(
        'createFractalEngine requires requestAnimationFrame/cancelAnimationFrame (provide via options in non-browser envs).',
      );
    }

    this.context = null;
    this.worker = null;
    this.resizeObserver = null;
    this.animationId = null;
    this.handleWorkerMessage = this.handleWorkerMessage.bind(this);
    this.renderFrame = this.renderFrame.bind(this);

    this.paletteBuffer = null;
    this.paletteVersion = 0;
    this.paletteSentVersion = -1;

    this.busy = false;
    this.pendingMessage = null;
    this.lastTimestamp = 0;

    this.telemetry = {
      runningAverageMs: 16.7,
      fps: 60,
      frames: 0,
      lastFrameMs: 0,
    };

    this.running = false;
  }

  initialize() {
    const context = this.canvas.getContext('2d', { willReadFrequently: false });
    if (!context) {
      throw new Error('Unable to acquire 2D context for fractal engine.');
    }
    this.context = context;

    this.resizeCanvas();
    this.setupResizeObserver();
    this.createWorker();

    this.running = true;
    this.animationId = this.options.requestAnimationFrame(this.renderFrame);
  }

  setupResizeObserver() {
    if (!this.options.ResizeObserver) {
      return;
    }
    this.resizeObserver = new this.options.ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas);
  }

  createWorker() {
    this.worker = this.options.createWorker();
    if (!this.worker) {
      throw new Error('Fractal engine failed to create a worker instance.');
    }
    this.worker.addEventListener('message', this.handleWorkerMessage);
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const deviceRatio = Math.min(
      this.options.maxDevicePixelRatio,
      Math.max(1, resolveDevicePixelRatio(this.options.getDevicePixelRatio)),
    );
    const nextWidth = Math.max(1, Math.floor(rect.width * deviceRatio));
    const nextHeight = Math.max(1, Math.floor(rect.height * deviceRatio));

    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
    }
  }

  handleWorkerMessage(event) {
    const message = event.data;
    if (!message || message.type !== 'render-result') {
      this.options.onWorkerMessage?.(message);
      return;
    }

    const targetContext = this.context;
    if (targetContext && message.buffer) {
      const pixels = new Uint8ClampedArray(message.buffer);
      const imageData = new ImageData(pixels, message.width, message.height);
      if (this.options.onDraw) {
        this.options.onDraw(targetContext, imageData);
      } else {
        targetContext.putImageData(imageData, 0, 0);
      }
    }

    this.busy = false;

    if (this.pendingMessage) {
      const queued = this.pendingMessage;
      this.pendingMessage = null;
      this.busy = true;
      this.worker?.postMessage(queued);
    }
  }

  renderFrame(timestamp) {
    if (!this.running) {
      return;
    }
    this.animationId = this.options.requestAnimationFrame(this.renderFrame);

    const elapsed = timestamp - this.lastTimestamp;
    if (elapsed < this.options.minRenderInterval) {
      return;
    }
    this.lastTimestamp = timestamp;
    const deltaSeconds = Math.max(0.001, elapsed / 1000);

    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!width || !height || !this.context) {
      return;
    }

    if (this.paletteBuffer && this.paletteVersion !== this.paletteSentVersion) {
      this.worker?.postMessage({
        type: 'set-palette',
        colors: this.paletteBuffer,
      });
      this.paletteSentVersion = this.paletteVersion;
    }

    if (typeof this.options.computeRenderPayload !== 'function') {
      return;
    }

    const payload = this.options.computeRenderPayload({
      timestamp,
      deltaMs: elapsed,
      deltaSeconds,
      canvas: this.canvas,
      width,
      height,
    });

    if (!payload) {
      return;
    }

    const message = {
      type: 'render',
      width,
      height,
      ...payload,
    };

    if (this.busy) {
      this.pendingMessage = message;
    } else {
      this.busy = true;
      this.worker?.postMessage(message);
    }

    this.updateTelemetry(elapsed);
  }

  updateTelemetry(elapsedMs) {
    this.telemetry.frames += 1;
    const smoothing = 0.1;
    this.telemetry.runningAverageMs =
      this.telemetry.runningAverageMs * (1 - smoothing) + elapsedMs * smoothing;
    this.telemetry.fps = 1000 / Math.max(this.telemetry.runningAverageMs, 0.001);
    this.telemetry.lastFrameMs = elapsedMs;

    this.options.onTelemetry?.({
      fps: this.telemetry.fps,
      frameTimeMs: elapsedMs,
      totalFrames: this.telemetry.frames,
    });
  }

  /**
   * Update the palette buffer to send to the worker.
   * @param {Float32Array} buffer
   */
  setPalette(buffer) {
    if (!(buffer instanceof Float32Array)) {
      throw new Error('Palette buffer must be a Float32Array.');
    }
    this.paletteBuffer = buffer;
    this.paletteVersion += 1;
  }

  /**
   * Replace the compute render callback.
   * @param {(frame: FractalFrameContext) => (FractalRenderPayload|null|undefined)} callback
   */
  setRenderCallback(callback) {
    this.options.computeRenderPayload = callback;
  }

  /**
   * Apply engine configuration changes at runtime.
   * @param {{ minRenderInterval?: number; maxDevicePixelRatio?: number }} config
   */
  updateConfig(config) {
    if (typeof config.minRenderInterval === 'number') {
      this.options.minRenderInterval = Math.max(0, config.minRenderInterval);
    }
    if (typeof config.maxDevicePixelRatio === 'number') {
      this.options.maxDevicePixelRatio = Math.max(1, config.maxDevicePixelRatio);
      this.resizeCanvas();
    }
  }

  /**
   * No-op save point for preset application – hooks can override via callback.
   * @param {string} preset
   */
  applyPreset(preset) {
    this.options.onApplyPreset?.(preset);
  }

  /**
   * Update engine settings without recreating the instance.
   * @param {{
   *  minRenderInterval?: number;
   *  maxDevicePixelRatio?: number;
   *  computeRenderPayload?: (frame: FractalFrameContext) => (FractalRenderPayload|null|undefined);
   *  onTelemetry?: ((telemetry: FractalTelemetry) => void)|null;
   *  onDraw?: ((context: CanvasRenderingContext2D, image: ImageData) => void)|null;
   *  onWorkerMessage?: ((message: any) => void)|null;
   * }} settings
   */
  updateSettings(settings = {}) {
    if (!settings || typeof settings !== 'object') {
      return;
    }

    const config = {};
    if (Object.prototype.hasOwnProperty.call(settings, 'minRenderInterval')) {
      config.minRenderInterval = settings.minRenderInterval;
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'maxDevicePixelRatio')) {
      config.maxDevicePixelRatio = settings.maxDevicePixelRatio;
    }
    if (Object.keys(config).length > 0) {
      this.updateConfig(config);
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'computeRenderPayload')) {
      const renderCallback = settings.computeRenderPayload;
      this.options.computeRenderPayload =
        typeof renderCallback === 'function' ? renderCallback : null;
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'onTelemetry')) {
      this.options.onTelemetry = settings.onTelemetry ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'onDraw')) {
      this.options.onDraw = settings.onDraw ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'onWorkerMessage')) {
      this.options.onWorkerMessage = settings.onWorkerMessage ?? null;
    }
  }

  /**
   * Read the latest telemetry snapshot.
   */
  getTelemetry() {
    return { ...this.telemetry };
  }

  destroy() {
    this.running = false;
    if (this.animationId !== null) {
      this.options.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.worker) {
      this.worker.removeEventListener('message', this.handleWorkerMessage);
      this.worker.terminate();
      this.worker = null;
    }
    this.context = null;
    this.pendingMessage = null;
    this.busy = false;
  }
}

/**
 * Create and initialize a fractal engine instance.
 * @param {HTMLCanvasElement} canvas
 * @param {FractalEngineOptions} [options]
 */
export function createFractalEngine(canvas, options) {
  const engine = new FractalEngine(canvas, options);
  engine.initialize();
  return engine;
}

export default createFractalEngine;

