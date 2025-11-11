import { useEffect, useMemo, useRef, useState } from 'react';

const FRACTAL_PALETTES = [
  ['#ff6b6b', '#f06595', '#845ef7', '#5c7cfa', '#51cf66', '#ffd43b'],
  ['#f97316', '#e11d48', '#a855f7', '#6366f1', '#22d3ee', '#14b8a6'],
  ['#b91c1c', '#f97316', '#facc15', '#84cc16', '#22c55e', '#0ea5e9'],
  ['#f43f5e', '#d946ef', '#8b5cf6', '#6366f1', '#0ea5e9', '#06b6d4'],
  ['#fb7185', '#f9a8d4', '#c4b5fd', '#93c5fd', '#67e8f9', '#6ee7b7'],
  ['#f97316', '#fb7185', '#f472b6', '#a855f7', '#22d3ee', '#4ade80'],
];

const FRAME_INTERVAL = 75;
const MAX_DEVICE_PIXEL_RATIO = 2;

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

  return lut;
}

function randomJuliaSeed() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.6 + Math.random() * 0.35;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export default function FractalExperience() {
  const initialModeRef = useRef(Math.random() > 0.5 ? 'mandelbrot' : 'julia');

  const [fractalType, setFractalType] = useState(initialModeRef.current);
  const [juliaSeed, setJuliaSeed] = useState(() => randomJuliaSeed());
  const [paletteIndex, setPaletteIndex] = useState(() =>
    Math.floor(Math.random() * FRACTAL_PALETTES.length),
  );
  const [autoZoomSpeed, setAutoZoomSpeed] = useState(() => 0.004 + Math.random() * 0.005);
  const [autoZoomDirection, setAutoZoomDirection] = useState(-1);
  const [statusMessage, setStatusMessage] = useState('');

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const pointerRef = useRef({
    targetX: 0.5,
    targetY: 0.5,
    active: false,
  });

  const viewRef = useRef({
    baseCenterX: initialModeRef.current === 'mandelbrot' ? -0.5 : 0,
    baseCenterY: 0,
    scale: 3,
    pointerX: 0.5,
    pointerY: 0.5,
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
  const paletteBufferRef = useRef(paletteData.colors);
  const paletteVersionRef = useRef(0);
  const paletteSentVersionRef = useRef(-1);
  const fractalTypeRef = useRef(fractalType);
  const juliaSeedRef = useRef(juliaSeed);
  const autoZoomSpeedRef = useRef(autoZoomSpeed);
  const autoZoomDirectionRef = useRef(autoZoomDirection);

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
        busyRef.current = false;
        return;
      }

      if (message.buffer) {
        const pixels = new Uint8ClampedArray(message.buffer);
        const imageData = new ImageData(pixels, message.width, message.height);
        targetContext.putImageData(imageData, 0, 0);
      }

      busyRef.current = false;
    };

    worker.addEventListener('message', handleWorkerMessage);

    let lastTimestamp = 0;

    const renderFrame = (timestamp) => {
      animationRef.current = requestAnimationFrame(renderFrame);

      if (timestamp - lastTimestamp < FRAME_INTERVAL) {
        return;
      }
      lastTimestamp = timestamp;

      const { width, height } = canvas;
      if (!width || !height) {
        return;
      }

      if (busyRef.current) {
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
      const pointerTarget = pointerRef.current;

      view.pointerX += (pointerTarget.targetX - view.pointerX) * 0.08;
      view.pointerY += (pointerTarget.targetY - view.pointerY) * 0.08;

      const aspectRatio = height / width;
      const scaledHeight = view.scale * aspectRatio;
      const pointerOffsetX = (view.pointerX - 0.5) * view.scale * 0.6;
      const pointerOffsetY = (view.pointerY - 0.5) * scaledHeight * 0.6;

      const centerX = view.baseCenterX + pointerOffsetX;
      const centerY = view.baseCenterY + pointerOffsetY;

      const zoomFactor = Math.log10(1 / Math.max(view.scale, 1e-9)) || 0;
      const maxIterations = Math.min(
        900,
        Math.max(180, Math.floor(190 + zoomFactor * 90)),
      );

      busyRef.current = true;

      worker.postMessage({
        type: 'render',
        width,
        height,
        fractalType: fractalTypeRef.current,
        juliaSeed: fractalTypeRef.current === 'julia' ? juliaSeedRef.current : null,
        maxIterations,
        view: {
          centerX,
          centerY,
          scale: view.scale,
          aspectRatio,
        },
      });

      const multiplier =
        autoZoomDirectionRef.current === -1
          ? 1 - autoZoomSpeedRef.current
          : 1 + autoZoomSpeedRef.current;
      view.scale = Math.max(1e-8, Math.min(8, view.scale * multiplier));
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
    };
  }, []);

  const alignViewToType = (type) => {
    viewRef.current.baseCenterX = type === 'mandelbrot' ? -0.5 : 0;
    viewRef.current.baseCenterY = 0;
    viewRef.current.scale = 3;
  };

  const handlePaletteShuffle = () => {
    let next = Math.floor(Math.random() * FRACTAL_PALETTES.length);
    if (next === paletteIndex) {
      next = (next + 1) % FRACTAL_PALETTES.length;
    }
    setPaletteIndex(next);
    setStatusMessage(`Palette ${next + 1} loaded`);
  };

  const handleFractalToggle = () => {
    const next = fractalType === 'mandelbrot' ? 'julia' : 'mandelbrot';
    setFractalType(next);
    if (next === 'julia') {
      setJuliaSeed(randomJuliaSeed());
    }
    alignViewToType(next);
    setStatusMessage(`Exploring the ${next === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} set`);
  };

  const handleFractalReshuffle = () => {
    const nextType = Math.random() > 0.5 ? 'mandelbrot' : 'julia';
    setFractalType(nextType);
    if (nextType === 'julia') {
      setJuliaSeed(randomJuliaSeed());
    }
    alignViewToType(nextType);

    let nextPalette = Math.floor(Math.random() * FRACTAL_PALETTES.length);
    if (nextPalette === paletteIndex) {
      nextPalette = (nextPalette + 1) % FRACTAL_PALETTES.length;
    }
    setPaletteIndex(nextPalette);

    const labelType = nextType === 'mandelbrot' ? 'Mandelbrot' : 'Julia';
    setStatusMessage(`Shuffled to the ${labelType} set with palette ${nextPalette + 1}`);
  };

  const handleJuliaReseed = () => {
    const nextSeed = randomJuliaSeed();
    setJuliaSeed(nextSeed);
    alignViewToType('julia');
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
    setAutoZoomDirection(next);
    setStatusMessage(`Auto zoom flowing ${next === -1 ? 'inward' : 'outward'}`);
  };

  const handlePointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.targetX = (event.clientX - rect.left) / rect.width;
    pointerRef.current.targetY = (event.clientY - rect.top) / rect.height;
    pointerRef.current.active = true;
  };

  const handlePointerLeave = () => {
    pointerRef.current.targetX = 0.5;
    pointerRef.current.targetY = 0.5;
    pointerRef.current.active = false;
  };

  const handleTouch = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.targetX = (touch.clientX - rect.left) / rect.width;
    pointerRef.current.targetY = (touch.clientY - rect.top) / rect.height;
    pointerRef.current.active = true;
  };

  const autoZoomValue = Math.round(autoZoomSpeed * 1000);

  return (
    <section className="relative isolate overflow-hidden px-4 py-12 sm:py-16">
      <div className="pointer-events-none absolute -left-40 top-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl sm:h-[26rem] sm:w-[26rem]" />
      <div className="pointer-events-none absolute -right-24 bottom-12 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl sm:h-[24rem] sm:w-[24rem]" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl bg-slate-900/70 p-6 shadow-xl ring-1 ring-slate-700/40 backdrop-blur transition-shadow duration-500 hover:shadow-2xl md:p-10">
        <div className="group relative w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-950/80 shadow-inner">
          <canvas
            ref={canvasRef}
            className="block w-full cursor-crosshair select-none rounded-3xl bg-slate-950/80 [aspect-ratio:3/2] transition-transform duration-700 ease-out group-hover:scale-[1.01]"
            role="img"
            aria-label={`Animated ${fractalType === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} fractal visualization`}
            onMouseEnter={handlePointer}
            onMouseMove={handlePointer}
            onMouseLeave={handlePointerLeave}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
            onTouchEnd={handlePointerLeave}
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(244,63,94,0.12),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.1),transparent_60%)] mix-blend-screen animate-glow-orbit" />
            <div className="absolute -inset-24 opacity-30 blur-3xl mix-blend-screen animate-float-gradient bg-[conic-gradient(from_120deg_at_50%_50%,rgba(168,85,247,0.18),rgba(14,165,233,0.15),transparent_65%)]" />
          </div>
        </div>

        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Fractal Lab
            </p>
            <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">
              Psychedelic {fractalType === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} Explorer
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-400">
              Glide the cursor to warp the fractal focus, let the auto-zoom pull you deeper,
              shuffle the palette, and reroll between Mandelbrot or Julia sets for endless visual trips.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-3 md:gap-4">
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

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex w-full max-w-xl items-center gap-3 text-sm text-slate-300">
            <span className="font-medium text-slate-100">Auto Zoom Speed</span>
            <input
              type="range"
              min="0"
              max="18"
              value={autoZoomValue}
              onChange={(event) => setAutoZoomSpeed(Number(event.target.value) / 1000)}
              aria-valuetext={`${autoZoomValue} per mille`}
              className="h-1 flex-1 cursor-ew-resize appearance-none rounded-full bg-slate-700 accent-fuchsia-500"
            />
            <span className="w-12 text-right font-mono text-xs text-slate-400">
              {autoZoomValue}
              ‰
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
          </div>
        </div>
      </div>
      <span aria-live="polite" role="status" className="sr-only">
        {statusMessage}
      </span>
    </section>
  );
}

