import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const FRACTAL_PALETTES = [
  ['#ff6b6b', '#f06595', '#845ef7', '#5c7cfa', '#51cf66', '#ffd43b'],
  ['#f97316', '#e11d48', '#a855f7', '#6366f1', '#22d3ee', '#14b8a6'],
  ['#b91c1c', '#f97316', '#facc15', '#84cc16', '#22c55e', '#0ea5e9'],
  ['#f43f5e', '#d946ef', '#8b5cf6', '#6366f1', '#0ea5e9', '#06b6d4'],
  ['#fb7185', '#f9a8d4', '#c4b5fd', '#93c5fd', '#67e8f9', '#6ee7b7'],
  ['#f97316', '#fb7185', '#f472b6', '#a855f7', '#22d3ee', '#4ade80'],
];

const MIN_RENDER_INTERVAL = 5;
const MAX_DEVICE_PIXEL_RATIO = 2;
const ZOOM_SMOOTHING_FACTOR = 0.85; // Higher = smoother but slower response (0-1)
const AUTO_ZOOM_MIN_PERCENT = 1;
const AUTO_ZOOM_MAX_PERCENT = 100;
const AUTO_ZOOM_MIN_SPEED = 0.001;
const AUTO_ZOOM_MAX_SPEED = 0.018;
const PALETTE_COOLDOWN_SECONDS = 10;
const VARIANT_COOLDOWN_SECONDS = 14;
const JULIA_COOLDOWN_SECONDS = 8;
const MUTATION_INTERVAL_MIN = 7;
const MUTATION_INTERVAL_MAX = 13;
const ZOOM_DIRECTION_COOLDOWN_SECONDS = 6;
const ZOOM_OUT_MAX_SECONDS = 4;
const FRACTAL_VARIANTS = ['classic', 'cubic', 'burning-ship', 'perpendicular'];

function hexToRgb(hex) {
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = channel(r);
  const G = channel(g);
  const B = channel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function normalizePaletteContrast(lut, minimumRange = 0.95, gamma = 0.9) {
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
            Math.pow(
              Math.max(0, Math.min(1, ((channel * ratio) / 255))),
              gamma,
            ),
        ),
      );

    return {
      r: remap(color.r),
      g: remap(color.g),
      b: remap(color.b),
    };
  });
}

function buildPaletteLut(colors, steps = 1024) {
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

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomJuliaSeed() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.6 + Math.random() * 0.35;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function autoZoomSpeedToPercent(speed) {
  const clamped = clamp(speed, AUTO_ZOOM_MIN_SPEED, AUTO_ZOOM_MAX_SPEED);
  const ratio =
    (clamped - AUTO_ZOOM_MIN_SPEED) /
    (AUTO_ZOOM_MAX_SPEED - AUTO_ZOOM_MIN_SPEED);
  return (
    ratio * (AUTO_ZOOM_MAX_PERCENT - AUTO_ZOOM_MIN_PERCENT) +
    AUTO_ZOOM_MIN_PERCENT
  );
}

function percentToAutoZoomSpeed(percent) {
  const clamped = clamp(percent, AUTO_ZOOM_MIN_PERCENT, AUTO_ZOOM_MAX_PERCENT);
  const ratio =
    (clamped - AUTO_ZOOM_MIN_PERCENT) /
    (AUTO_ZOOM_MAX_PERCENT - AUTO_ZOOM_MIN_PERCENT);
  return AUTO_ZOOM_MIN_SPEED + ratio * (AUTO_ZOOM_MAX_SPEED - AUTO_ZOOM_MIN_SPEED);
}

function formatVariantLabel(variant) {
  if (!variant || variant === 'classic') {
    return 'classic';
  }
  return variant.replace(/-/g, ' ');
}

export default function FractalExperience() {
  const initialModeRef = useRef(Math.random() > 0.5 ? 'mandelbrot' : 'julia');

  const [fractalType, setFractalType] = useState(initialModeRef.current);
  const [juliaSeed, setJuliaSeed] = useState(() => randomJuliaSeed());
  const [paletteIndex, setPaletteIndex] = useState(() =>
    Math.floor(Math.random() * FRACTAL_PALETTES.length),
  );
  const [autoZoomSpeed, setAutoZoomSpeed] = useState(() =>
    clamp(0.0025 + Math.random() * 0.003, AUTO_ZOOM_MIN_SPEED, AUTO_ZOOM_MAX_SPEED),
  );
  const [autoZoomDirection, setAutoZoomDirection] = useState(-1);
  const [statusMessage, setStatusMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const viewRef = useRef({
    baseCenterX: initialModeRef.current === 'mandelbrot' ? -0.5 : 0,
    baseCenterY: 0,
    scale: 3,
  });

  const paletteData = useMemo(() => {
    const lut = buildPaletteLut(FRACTAL_PALETTES[paletteIndex], 2048);
    const colors = new Float32Array(lut.length * 3);

    for (let i = 0; i < lut.length; i += 1) {
      const offset = i * 3;
      colors[offset] = lut[i].r;
      colors[offset + 1] = lut[i].g;
      colors[offset + 2] = lut[i].b;
    }

    return { lut, colors };
  }, [paletteIndex]);

  const workerRef = useRef(null);
  const contextRef = useRef(null);
  const busyRef = useRef(false);
  const pendingViewRef = useRef(null);
  const paletteBufferRef = useRef(paletteData.colors);
  const paletteVersionRef = useRef(0);
  const paletteSentVersionRef = useRef(-1);
  const fractalTypeRef = useRef(fractalType);
  const fractalVariantRef = useRef('classic');
  const juliaSeedRef = useRef(juliaSeed);
  const autoZoomSpeedRef = useRef(autoZoomSpeed);
  const autoZoomDirectionRef = useRef(autoZoomDirection);
  const paletteIndexRef = useRef(paletteIndex);
  const ambientStateRef = useRef({
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: randomRange(0.45, 0.85),
    breathePhase: Math.random() * Math.PI * 2,
    breatheSpeed: randomRange(0.08, 0.16),
    driftPhase: Math.random() * Math.PI * 2,
    driftSpeed: randomRange(0.012, 0.028),
    orbitPhase: Math.random() * Math.PI * 2,
    mutationElapsed: 0,
    mutationInterval: randomRange(MUTATION_INTERVAL_MIN, MUTATION_INTERVAL_MAX),
    driftOffsetX: 0,
    driftOffsetY: 0,
    juliaPhase: 0,
    juliaMorphSpeed: randomRange(0.04, 0.08),
    juliaSource: randomJuliaSeed(),
    juliaTarget: randomJuliaSeed(),
    juliaAccumulator: 0,
    paletteCooldown: 0,
    variantCooldown: 0,
    seedCooldown: 0,
    zoomDirectionCooldown: 0,
    zoomOutTimer: 0,
  });

  useEffect(() => {
    paletteBufferRef.current = paletteData.colors;
    paletteVersionRef.current += 1;
  }, [paletteData]);

  useEffect(() => {
    fractalTypeRef.current = fractalType;
  }, [fractalType]);

  useEffect(() => {
    juliaSeedRef.current = juliaSeed;
  }, [juliaSeed]);

  useEffect(() => {
    autoZoomSpeedRef.current = autoZoomSpeed;
  }, [autoZoomSpeed]);

  useEffect(() => {
    autoZoomDirectionRef.current = autoZoomDirection;
  }, [autoZoomDirection]);

  useEffect(() => {
    paletteIndexRef.current = paletteIndex;
  }, [paletteIndex]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreenActive =
        !!document.fullscreenElement ||
        !!document.webkitFullscreenElement ||
        !!document.mozFullScreenElement ||
        !!document.msFullscreenElement;
      setIsFullscreen(isFullscreenActive);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const focusRingClass =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400';
  const buttonBaseClass = [
    'interactive-button rounded-full px-4 py-2 text-sm font-medium',
    'transition duration-200 ease-out',
    'hover:-translate-y-[1px] hover:shadow-lg hover:shadow-[0_16px_32px_rgba(15,23,42,0.35)]',
    'active:translate-y-[1px]',
    focusRingClass,
  ].join(' ');
  const neutralButtonClass = `${buttonBaseClass} bg-slate-100/10 text-slate-100 hover:bg-slate-100/20`;
  const accentButtonClass = `${buttonBaseClass} bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30 hover:shadow-[0_18px_45px_rgba(217,70,239,0.35)]`;
  const cyanButtonClass = `${buttonBaseClass} bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 hover:shadow-[0_18px_45px_rgba(14,165,233,0.35)]`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d', { willReadFrequently: false });
    if (!context) {
      return;
    }

    contextRef.current = context;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const deviceRatio = Math.min(MAX_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1);
      const nextWidth = Math.max(1, Math.floor(rect.width * deviceRatio));
      const nextHeight = Math.max(1, Math.floor(rect.height * deviceRatio));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    const worker = new Worker(new URL('../workers/fractalWorker.js', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    const handleWorkerMessage = (event) => {
      const message = event.data;
      if (!message || message.type !== 'render-result') {
        return;
      }

      const targetContext = contextRef.current;
      if (!targetContext) {
        return;
      }

      if (message.buffer) {
        const pixels = new Uint8ClampedArray(message.buffer);
        const imageData = new ImageData(pixels, message.width, message.height);
        targetContext.putImageData(imageData, 0, 0);
      }

      busyRef.current = false;

      const queued = pendingViewRef.current;
      if (queued) {
        pendingViewRef.current = null;
        busyRef.current = true;
        worker.postMessage(queued);
      }
    };

    worker.addEventListener('message', handleWorkerMessage);

    let lastTimestamp = 0;

    const renderFrame = (timestamp) => {
      animationRef.current = requestAnimationFrame(renderFrame);

      const elapsed = timestamp - lastTimestamp;
      if (elapsed < MIN_RENDER_INTERVAL) {
        return;
      }
      lastTimestamp = timestamp;
      const deltaSeconds = Math.max(0.001, elapsed / 1000);

      const { width, height } = canvas;
      if (!width || !height) {
        return;
      }

      if (paletteVersionRef.current !== paletteSentVersionRef.current) {
        worker.postMessage({
          type: 'set-palette',
          colors: paletteBufferRef.current,
        });
        paletteSentVersionRef.current = paletteVersionRef.current;
      }

      const view = viewRef.current;
      const ambient = ambientStateRef.current;

      const aspectRatio = height / width;
      const scaledHeight = view.scale * aspectRatio;
      const pointerOffsetX = 0;
      const pointerOffsetY = 0;

      const driftOffsetX = ambient.driftOffsetX * view.scale * 0.45;
      const driftOffsetY = ambient.driftOffsetY * scaledHeight * 0.45;

      const centerX = view.baseCenterX + pointerOffsetX + driftOffsetX;
      const centerY = view.baseCenterY + pointerOffsetY + driftOffsetY;

      const zoomFactor = Math.log10(1 / Math.max(view.scale, 1e-9)) || 0;
      const organicEnergy =
        1 + Math.sin(ambient.pulsePhase * 0.5 + ambient.breathePhase) * 0.18;
      const baseIterations = 190 + zoomFactor * 90;
      const maxIterations = Math.min(
        900,
        Math.max(180, Math.floor(baseIterations * organicEnergy)),
      );

      const message = {
        type: 'render',
        width,
        height,
        fractalType: fractalTypeRef.current,
        fractalVariant: fractalVariantRef.current,
        juliaSeed: fractalTypeRef.current === 'julia' ? juliaSeedRef.current : null,
        maxIterations,
        view: {
          centerX,
          centerY,
          scale: view.scale,
          aspectRatio,
        },
      };

      if (busyRef.current) {
        pendingViewRef.current = message;
      } else {
        busyRef.current = true;
        worker.postMessage(message);
      }

      // Ultra-smooth zoom calculation - fully frame-rate independent
      const zoomRate = autoZoomSpeedRef.current;
      const zoomDirection = autoZoomDirectionRef.current;
      const currentScale = view.scale;
      
      // Calculate instantaneous zoom multiplier per second
      const perSecondMultiplier = zoomDirection === -1 
        ? 1 - zoomRate  // Zoom in (scale decreases)
        : 1 + zoomRate; // Zoom out (scale increases)
      
      // Apply zoom over elapsed time for frame-rate independence
      const timeBasedMultiplier = Math.pow(perSecondMultiplier, deltaSeconds);
      const rawTargetScale = currentScale * timeBasedMultiplier;
      const pulseWave = 1 + Math.sin(ambient.pulsePhase) * 0.11;
      const breatheWave =
        1 + Math.sin(ambient.breathePhase * 0.9 + ambient.pulsePhase * 0.33) * 0.06;
      const organicMultiplier = Math.max(0.78, pulseWave * breatheWave);
      const perFrameDamping = 1 - Math.pow(0.92, deltaSeconds * 60);
      const easedTargetScale =
        currentScale +
        (rawTargetScale * organicMultiplier - currentScale) * perFrameDamping;
      
      // Frame-rate independent exponential smoothing
      // Converts fixed-per-frame smoothing to time-based smoothing
      const zoomSmoothing = 1 - Math.pow(ZOOM_SMOOTHING_FACTOR, deltaSeconds * 60);
      view.scale = currentScale + (easedTargetScale - currentScale) * zoomSmoothing;
    };

    animationRef.current = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
      worker.removeEventListener('message', handleWorkerMessage);
      worker.terminate();
      workerRef.current = null;
      contextRef.current = null;
      busyRef.current = false;
      pendingViewRef.current = null;
    };
  }, []);

  const alignViewToType = useCallback(
    (type, options = {}) => {
      const { resetScale = true, recenter = resetScale } = options;
      const view = viewRef.current;
      if (recenter) {
        view.baseCenterX = type === 'mandelbrot' ? -0.5 : 0;
        view.baseCenterY = 0;
      }

      if (resetScale) {
        view.scale = 3;
        const ambient = ambientStateRef.current;
        ambient.zoomOutTimer = 0;
        ambient.zoomDirectionCooldown = ZOOM_DIRECTION_COOLDOWN_SECONDS;

        autoZoomDirectionRef.current = -1;
        setAutoZoomDirection(-1);

        const nextSpeed = clamp(
          Math.max(autoZoomSpeedRef.current, 0.006),
          AUTO_ZOOM_MIN_SPEED,
          AUTO_ZOOM_MAX_SPEED,
        );
        autoZoomSpeedRef.current = nextSpeed;
        setAutoZoomSpeed(nextSpeed);
      }
    },
    [setAutoZoomDirection, setAutoZoomSpeed],
  );

  const runFractalMutation = useCallback(() => {
    const updates = [];
    const choices = [];

    const ambient = ambientStateRef.current;

    const mutatePalette = () => {
      let nextPalette = Math.floor(Math.random() * FRACTAL_PALETTES.length);
      if (nextPalette === paletteIndexRef.current) {
        nextPalette = (nextPalette + 1) % FRACTAL_PALETTES.length;
      }
      paletteIndexRef.current = nextPalette;
      setPaletteIndex(nextPalette);
      updates.push(`Colors mutate (#${nextPalette + 1})`);
      ambient.paletteCooldown = PALETTE_COOLDOWN_SECONDS;
    };
    let paletteMutated = false;
    if (ambient.paletteCooldown <= 0 && Math.random() < 0.45) {
      mutatePalette();
      paletteMutated = true;
    }
    if (!paletteMutated && ambient.paletteCooldown <= 0) {
      choices.push(mutatePalette);
    }

    const toggleFractalType = () => {
      const nextType = fractalTypeRef.current === 'mandelbrot' ? 'julia' : 'mandelbrot';
      fractalTypeRef.current = nextType;
      setFractalType(nextType);
      alignViewToType(nextType);
      if (nextType === 'julia') {
        const nextSeed = randomJuliaSeed();
        juliaSeedRef.current = nextSeed;
        setJuliaSeed(nextSeed);
        updates.push('Fractal reforms as a Julia bloom');
      } else {
        updates.push('Fractal reforms as a Mandelbrot bloom');
      }
    };
    choices.push(toggleFractalType);

    const mutateVariant = () => {
      const currentVariant = fractalVariantRef.current;
      const options = FRACTAL_VARIANTS.filter((variant) => variant !== currentVariant);
      const nextVariant = options[Math.floor(Math.random() * options.length)];
      fractalVariantRef.current = nextVariant;
      updates.push(`Fractal reforms as ${nextVariant.replace('-', ' ')}`);
      ambient.variantCooldown = VARIANT_COOLDOWN_SECONDS;
    };
    if (fractalTypeRef.current === 'mandelbrot' && ambient.variantCooldown <= 0) {
      choices.push(mutateVariant);
    }

    if (fractalTypeRef.current === 'julia') {
      const reseedJulia = () => {
        if (ambient.seedCooldown > 0) {
          return;
        }
        const nextSeed = randomJuliaSeed();
        juliaSeedRef.current = nextSeed;
        setJuliaSeed(nextSeed);
        alignViewToType('julia', { resetScale: false, recenter: false });
        updates.push('Julia seed mutates and reforms');
        ambient.seedCooldown = JULIA_COOLDOWN_SECONDS;
      };
      if (ambient.seedCooldown <= 0 && Math.random() < 0.45) {
        reseedJulia();
      } else {
        choices.push(reseedJulia);
      }
    }

    const mutateZoomSpeed = () => {
      const nextSpeed = clamp(randomRange(0.0032, 0.007), AUTO_ZOOM_MIN_SPEED, AUTO_ZOOM_MAX_SPEED);
      autoZoomSpeedRef.current = nextSpeed;
      setAutoZoomSpeed(nextSpeed);
      updates.push('Pulse rate shifts');
    };
    choices.push(mutateZoomSpeed);

    const mutateZoomDirection = () => {
      if (ambient.zoomDirectionCooldown > 0) {
        return;
      }
      const nextDirection = Math.random() > 0.78 ? 1 : -1;
      autoZoomDirectionRef.current = nextDirection;
      setAutoZoomDirection(nextDirection);
      if (nextDirection === 1) {
        ambient.zoomOutTimer = ZOOM_OUT_MAX_SECONDS;
        ambient.zoomDirectionCooldown = ZOOM_OUT_MAX_SECONDS;
      } else {
        ambient.zoomOutTimer = 0;
        ambient.zoomDirectionCooldown = ZOOM_DIRECTION_COOLDOWN_SECONDS;

        const nextSpeed = clamp(
          Math.max(autoZoomSpeedRef.current, 0.006),
          AUTO_ZOOM_MIN_SPEED,
          AUTO_ZOOM_MAX_SPEED,
        );
        autoZoomSpeedRef.current = nextSpeed;
        setAutoZoomSpeed(nextSpeed);
      }
      updates.push(nextDirection === -1 ? 'Energy spirals inward' : 'Energy breathes outward');
    };
    if (ambient.zoomDirectionCooldown <= 0) {
      choices.push(mutateZoomDirection);
    }

    const shiftCore = () => {
      const view = viewRef.current;
      const maxShift = view.scale * 0.28;
      view.baseCenterX += (Math.random() - 0.5) * maxShift;
      view.baseCenterY += (Math.random() - 0.5) * maxShift;
      updates.push('Core drifts into new currents');
    };
    choices.push(shiftCore);

    const mutateAmbientRhythm = () => {
      const ambient = ambientStateRef.current;
      ambient.pulseSpeed = randomRange(0.45, 0.9);
      ambient.breatheSpeed = randomRange(0.08, 0.19);
      ambient.driftSpeed = randomRange(0.012, 0.03);
      ambient.orbitPhase += Math.random() * Math.PI * 2;
      updates.push('Rhythms morph and breathe anew');
    };
    choices.push(mutateAmbientRhythm);

    const actionsToRun = Math.min(
      choices.length,
      Math.random() > 0.6 ? 2 : 1,
    );

    for (let i = 0; i < actionsToRun && choices.length; i += 1) {
      const index = Math.floor(Math.random() * choices.length);
      const action = choices.splice(index, 1)[0];
      action();
    }

    if (updates.length) {
      setStatusMessage(updates.join(' • '));
    }
  }, [
    alignViewToType,
    setAutoZoomSpeed,
    setAutoZoomDirection,
    setFractalType,
    setJuliaSeed,
    setPaletteIndex,
    setStatusMessage,
  ]);

  useEffect(() => {
    let rafId;
    let lastTime = performance.now();

    const step = (now) => {
      const ambient = ambientStateRef.current;
      const deltaSeconds = Math.max(0.001, (now - lastTime) / 1000);
      lastTime = now;

      ambient.pulsePhase +=
        deltaSeconds * ambient.pulseSpeed * (1.05 + Math.sin(ambient.breathePhase) * 0.2);
      ambient.breathePhase += deltaSeconds * ambient.breatheSpeed;
      ambient.driftPhase += deltaSeconds * ambient.driftSpeed;
      ambient.orbitPhase +=
        deltaSeconds * (0.12 + Math.sin(ambient.breathePhase * 0.8) * 0.05);

      const driftIntensity = 0.42 + Math.sin(ambient.breathePhase * 0.9) * 0.14;
      ambient.driftOffsetX = Math.cos(ambient.driftPhase) * driftIntensity;
      ambient.driftOffsetY = Math.sin(ambient.driftPhase * 1.18) * driftIntensity;
      ambient.paletteCooldown = Math.max(0, ambient.paletteCooldown - deltaSeconds);
      ambient.variantCooldown = Math.max(0, ambient.variantCooldown - deltaSeconds);
      ambient.seedCooldown = Math.max(0, ambient.seedCooldown - deltaSeconds);
      ambient.zoomDirectionCooldown = Math.max(
        0,
        ambient.zoomDirectionCooldown - deltaSeconds,
      );
      if (ambient.zoomOutTimer > 0) {
        ambient.zoomOutTimer = Math.max(0, ambient.zoomOutTimer - deltaSeconds);
        if (ambient.zoomOutTimer === 0 && autoZoomDirectionRef.current === 1) {
          autoZoomDirectionRef.current = -1;
          setAutoZoomDirection(-1);
        }
      }

      if (fractalTypeRef.current === 'julia') {
        ambient.juliaPhase += deltaSeconds * ambient.juliaMorphSpeed;
        if (ambient.juliaPhase >= 1) {
          ambient.juliaPhase -= 1;
          ambient.juliaSource = ambient.juliaTarget;
          ambient.juliaTarget = randomJuliaSeed();
          ambient.juliaMorphSpeed = randomRange(0.04, 0.09);
        }

        const morphT = easeInOut(ambient.juliaPhase);
        const nextSeed = {
          x: lerp(ambient.juliaSource.x, ambient.juliaTarget.x, morphT),
          y: lerp(ambient.juliaSource.y, ambient.juliaTarget.y, morphT),
        };
        juliaSeedRef.current = nextSeed;

        ambient.juliaAccumulator += deltaSeconds;
        if (ambient.juliaAccumulator >= 0.14) {
          ambient.juliaAccumulator = 0;
          setJuliaSeed(nextSeed);
        }
      } else {
        ambient.juliaPhase = 0;
        ambient.juliaAccumulator = 0;
      }

      ambient.mutationElapsed += deltaSeconds;
      if (ambient.mutationElapsed >= ambient.mutationInterval) {
      ambient.mutationElapsed = 0;
      ambient.mutationInterval = randomRange(MUTATION_INTERVAL_MIN, MUTATION_INTERVAL_MAX);
        runFractalMutation();
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [runFractalMutation]);

  const handlePaletteShuffle = () => {
    let next = Math.floor(Math.random() * FRACTAL_PALETTES.length);
    if (next === paletteIndex) {
      next = (next + 1) % FRACTAL_PALETTES.length;
    }
    paletteIndexRef.current = next;
    setPaletteIndex(next);
    setStatusMessage(`Palette ${next + 1} loaded`);
  };

  const handleFractalToggle = () => {
    const next = fractalType === 'mandelbrot' ? 'julia' : 'mandelbrot';
    fractalTypeRef.current = next;
    fractalVariantRef.current = 'classic';
    const ambient = ambientStateRef.current;
    ambient.variantCooldown = VARIANT_COOLDOWN_SECONDS;
    ambient.paletteCooldown = PALETTE_COOLDOWN_SECONDS * 0.5;
    setFractalType(next);
    if (next === 'julia') {
      const nextSeed = randomJuliaSeed();
      juliaSeedRef.current = nextSeed;
      setJuliaSeed(nextSeed);
    }
    alignViewToType(next);
    const variantLabel =
      next === 'mandelbrot' ? formatVariantLabel(fractalVariantRef.current) : 'classic';
    setStatusMessage(
      `Exploring the ${next === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} set (${variantLabel})`,
    );
  };

  const handleFractalReshuffle = () => {
    const nextType = Math.random() > 0.5 ? 'mandelbrot' : 'julia';
    fractalTypeRef.current = nextType;
    fractalVariantRef.current = FRACTAL_VARIANTS[
      Math.floor(Math.random() * FRACTAL_VARIANTS.length)
    ];
    const ambient = ambientStateRef.current;
    ambient.variantCooldown = VARIANT_COOLDOWN_SECONDS;
    ambient.paletteCooldown = PALETTE_COOLDOWN_SECONDS;
    setFractalType(nextType);
    if (nextType === 'julia') {
      const nextSeed = randomJuliaSeed();
      juliaSeedRef.current = nextSeed;
      setJuliaSeed(nextSeed);
    }
    alignViewToType(nextType);

    let nextPalette = Math.floor(Math.random() * FRACTAL_PALETTES.length);
    if (nextPalette === paletteIndex) {
      nextPalette = (nextPalette + 1) % FRACTAL_PALETTES.length;
    }
    paletteIndexRef.current = nextPalette;
    setPaletteIndex(nextPalette);

    const labelType = nextType === 'mandelbrot' ? 'Mandelbrot' : 'Julia';
    const variantLabel =
      nextType === 'mandelbrot' ? ` (${formatVariantLabel(fractalVariantRef.current)})` : '';
    setStatusMessage(
      `Shuffled to the ${labelType}${variantLabel} set with palette ${nextPalette + 1}`,
    );
  };

  const handleJuliaReseed = () => {
    const nextSeed = randomJuliaSeed();
    juliaSeedRef.current = nextSeed;
    setJuliaSeed(nextSeed);
    alignViewToType('julia', { resetScale: false, recenter: false });
    setStatusMessage('Generated a new Julia seed');
  };

  const handleManualZoom = (direction) => {
    const view = viewRef.current;
    const factor = direction === 'in' ? 0.8 : 1.25;
    view.scale = Math.max(1e-8, Math.min(8, view.scale * factor));
    setStatusMessage(`Manual zoom ${direction === 'in' ? 'in' : 'out'}`);
  };

  const handleAutoZoomDirectionToggle = () => {
    const next = autoZoomDirection === -1 ? 1 : -1;
    autoZoomDirectionRef.current = next;
    setAutoZoomDirection(next);
    setStatusMessage(`Auto zoom flowing ${next === -1 ? 'inward' : 'outward'}`);
  };

  const handleFullscreenToggle = async () => {
    const container = containerRef.current;
    if (!container) return;

    const isCurrentlyFullscreen =
      !!document.fullscreenElement ||
      !!document.webkitFullscreenElement ||
      !!document.mozFullScreenElement ||
      !!document.msFullscreenElement;

    try {
      if (!isCurrentlyFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          await container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          await container.msRequestFullscreen();
        }
        setStatusMessage('Entered fullscreen mode');
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        setStatusMessage('Exited fullscreen mode');
      }
    } catch (error) {
      setStatusMessage('Fullscreen not available');
    }
  };

  const autoZoomPercent = Math.round(autoZoomSpeedToPercent(autoZoomSpeed));
  const currentVariantLabel = formatVariantLabel(fractalVariantRef.current);

  return (
    <section className={`relative isolate overflow-hidden ${isFullscreen ? 'h-screen' : 'px-4 py-12 sm:py-16'}`}>
      {!isFullscreen && (
        <>
          <div className="pointer-events-none absolute -left-40 top-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl sm:h-[26rem] sm:w-[26rem]" />
          <div className="pointer-events-none absolute -right-24 bottom-12 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl sm:h-[24rem] sm:w-[24rem]" />
        </>
      )}
      <div
        ref={containerRef}
        className={`relative z-10 mx-auto flex w-full ${isFullscreen ? 'max-w-none h-full' : 'max-w-6xl'} flex-col gap-8 rounded-3xl bg-slate-900/70 p-6 shadow-xl ring-1 ring-slate-700/40 backdrop-blur transition-shadow duration-500 hover:shadow-2xl md:p-10 ${isFullscreen ? 'justify-center' : ''}`}
      >
        <div className={`group relative w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-950/80 shadow-inner ${isFullscreen ? 'h-full' : ''}`}>
          <canvas
            ref={canvasRef}
            className={`block w-full select-none rounded-3xl bg-slate-950/80 ${isFullscreen ? 'h-full' : '[aspect-ratio:3/2]'} transition-transform duration-700 ease-out group-hover:scale-[1.01]`}
            role="img"
            aria-label={`Animated ${fractalType === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} fractal visualization`}
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(244,63,94,0.12),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.1),transparent_60%)] mix-blend-screen animate-glow-orbit" />
            <div className="absolute -inset-24 opacity-30 blur-3xl mix-blend-screen animate-float-gradient bg-[conic-gradient(from_120deg_at_50%_50%,rgba(168,85,247,0.18),rgba(14,165,233,0.15),transparent_65%)]" />
          </div>
        </div>

        {!isFullscreen && (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                Fractal Lab
              </p>
              <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">
                Psychedelic {fractalType === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} Explorer
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-400">
                Let the living zoom pull you deeper, shuffle the palette, and reroll between Mandelbrot or Julia sets for endless visual trips.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3 md:gap-4">
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className={`${neutralButtonClass} hover:shadow-[0_18px_45px_rgba(14,165,233,0.25)]`}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <button
              type="button"
              onClick={handlePaletteShuffle}
              className={`${neutralButtonClass} hover:shadow-[0_18px_45px_rgba(236,72,153,0.25)]`}
            >
              Randomize Colors
            </button>
            <button
              type="button"
              onClick={handleFractalToggle}
              className={`${neutralButtonClass} hover:shadow-[0_18px_45px_rgba(45,212,191,0.25)]`}
            >
              Switch to {fractalType === 'mandelbrot' ? 'Julia' : 'Mandelbrot'}
            </button>
            <button
              type="button"
              onClick={handleFractalReshuffle}
              className={`${accentButtonClass} hover:-translate-y-[2px]`}
            >
              Shuffle Everything
            </button>
            <button
              type="button"
              onClick={() => handleManualZoom('in')}
              className={neutralButtonClass}
            >
              Zoom In
            </button>
            <button
              type="button"
              onClick={() => handleManualZoom('out')}
              className={neutralButtonClass}
            >
              Zoom Out
            </button>
            {fractalType === 'julia' && (
              <button
                type="button"
                onClick={handleJuliaReseed}
                className={`${cyanButtonClass} hover:-translate-y-[2px]`}
              >
                New Julia Seed
              </button>
            )}
          </div>
          </div>
        )}

        {isFullscreen && (
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className={`${neutralButtonClass} hover:shadow-[0_18px_45px_rgba(14,165,233,0.25)]`}
              aria-label="Exit fullscreen"
            >
              Exit Fullscreen
            </button>
          </div>
        )}

        {!isFullscreen && (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex w-full max-w-xl items-center gap-3 text-sm text-slate-300">
            <span className="font-medium text-slate-100">Auto Zoom Speed</span>
            <input
              type="range"
              min={AUTO_ZOOM_MIN_PERCENT}
              max={AUTO_ZOOM_MAX_PERCENT}
              value={autoZoomPercent}
              onChange={(event) => {
                const nextPercent = Number(event.target.value);
                const nextSpeed = percentToAutoZoomSpeed(nextPercent);
                autoZoomSpeedRef.current = nextSpeed;
                setAutoZoomSpeed(nextSpeed);
              }}
              aria-valuetext={`${autoZoomPercent}%`}
              className="h-1 flex-1 cursor-ew-resize appearance-none rounded-full bg-slate-700 accent-fuchsia-500"
            />
            <span className="w-12 text-right font-mono text-xs text-slate-400">
              {autoZoomPercent}
              %
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
            <button
              type="button"
              onClick={handleAutoZoomDirectionToggle}
              className={neutralButtonClass}
              aria-pressed={autoZoomDirection === 1}
            >
              Reverse Flow ({autoZoomDirection === -1 ? 'In' : 'Out'})
            </button>
            <div className="rounded-full bg-slate-100/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-slate-300">
              Palette #{paletteIndex + 1}
            </div>
              <div className="rounded-full bg-slate-100/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-slate-300">
                Variant: {currentVariantLabel}
              </div>
          </div>
        </div>
        )}
      </div>
      <span aria-live="polite" role="status" className="sr-only">
        {statusMessage}
      </span>
    </section>
  );
}

