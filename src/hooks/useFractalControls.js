import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FRACTAL_CONSTANTS,
  FRACTAL_PALETTES,
  FRACTAL_VARIANTS,
  SCENE_DEFINITIONS,
} from '../config/fractalSettings.js';
import {
  autoZoomSpeedToPercent,
  formatVariantLabel,
  percentToAutoZoomSpeed,
  pickFocusTarget,
  pickSceneDefinition,
  randomJuliaSeed,
} from '../utils/fractalControls.js';
import { buildPaletteLut } from '../utils/fractalColor.js';
import { clamp, lerp, pickFrom, randomRange } from '../utils/math.js';

const {
  AUTO_ZOOM_MIN_PERCENT,
  AUTO_ZOOM_MAX_PERCENT,
  AUTO_ZOOM_MIN_SPEED,
  AUTO_ZOOM_MAX_SPEED,
  FRACTAL_TYPE_COOLDOWN_SECONDS,
  INITIAL_VIEW_SCALE,
  JULIA_COOLDOWN_SECONDS,
  MAX_VIEW_SCALE,
  MIN_RENDER_INTERVAL,
  MIN_VIEW_SCALE,
  MUTATION_INTERVAL_MIN,
  MUTATION_INTERVAL_MAX,
  PALETTE_COOLDOWN_SECONDS,
  PALETTE_MUTATION_CHANCE,
  VARIANT_COOLDOWN_SECONDS,
  ZOOM_DIRECTION_COOLDOWN_SECONDS,
  ZOOM_OUT_MAX_SECONDS,
  ZOOM_SMOOTHING_FACTOR,
  FOCUS_INTERPOLATION,
  MAX_DEVICE_PIXEL_RATIO,
} = FRACTAL_CONSTANTS;

const easeInOut = (t) => t * t * (3 - 2 * t);

export function useFractalControls() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

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
  const [fractalVariant, setFractalVariant] = useState('classic');
  const [mutationsEnabled, setMutationsEnabled] = useState(true);
  const [activePreset, setActivePreset] = useState(null);

  const viewRef = useRef({
    baseCenterX: initialModeRef.current === 'mandelbrot' ? -0.5 : 0,
    baseCenterY: 0,
    scale: INITIAL_VIEW_SCALE,
  });

  const fractalTypeRef = useRef(fractalType);
  const fractalVariantRef = useRef(fractalVariant);
  const juliaSeedRef = useRef(juliaSeed);
  const autoZoomSpeedRef = useRef(autoZoomSpeed);
  const autoZoomDirectionRef = useRef(autoZoomDirection);
  const paletteIndexRef = useRef(paletteIndex);
  const mutationsEnabledRef = useRef(mutationsEnabled);

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
    typeCooldown: 0,
    sceneName: null,
    sceneElapsed: 0,
    sceneDuration: 0,
    sceneTargetScale: viewRef.current.scale,
    sceneShiftIntensity: 0.2,
    focusTarget: {
      x: viewRef.current.baseCenterX,
      y: viewRef.current.baseCenterY,
    },
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

  const presetOptions = useMemo(
    () =>
      SCENE_DEFINITIONS.map((scene) => ({
        name: scene.name,
        label: scene.name.replace(/-/g, ' '),
      })),
    [],
  );

  const updateFocusTarget = useCallback((scaleOverride) => {
    const ambient = ambientStateRef.current;
    const scale =
      typeof scaleOverride === 'number' && Number.isFinite(scaleOverride)
        ? scaleOverride
        : viewRef.current.scale;
    const focus = pickFocusTarget(
      fractalTypeRef.current,
      fractalVariantRef.current,
      scale,
    );
    if (focus) {
      ambient.focusTarget = { x: focus.x, y: focus.y };
      const view = viewRef.current;
      const snapBlend = scale < 0.05 ? 0.8 : 0.4;
      view.baseCenterX = lerp(view.baseCenterX, focus.x, snapBlend);
      view.baseCenterY = lerp(view.baseCenterY, focus.y, snapBlend);
    } else {
      ambient.focusTarget = null;
    }
  }, []);

  useEffect(() => {
    fractalTypeRef.current = fractalType;
  }, [fractalType]);

  useEffect(() => {
    fractalVariantRef.current = fractalVariant;
  }, [fractalVariant]);

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
    mutationsEnabledRef.current = mutationsEnabled;
  }, [mutationsEnabled]);

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

  const applyScene = useCallback(
    (sceneDef) => {
      const ambient = ambientStateRef.current;
      const view = viewRef.current;

      ambient.sceneName = sceneDef.name;
      setActivePreset(sceneDef.name);
      ambient.sceneElapsed = 0;
      ambient.sceneDuration = randomRange(...sceneDef.durationRange);
      const baseTarget = randomRange(...sceneDef.targetScaleRange);
      const currentScale = view.scale;
      const desiredScale = Math.min(currentScale * 0.7, baseTarget);
      ambient.sceneTargetScale = clamp(
        desiredScale,
        MIN_VIEW_SCALE,
        MAX_VIEW_SCALE * 0.95,
      );
      updateFocusTarget(ambient.sceneTargetScale);
      ambient.sceneShiftIntensity = sceneDef.shiftIntensity;

      const nextSpeed = clamp(
        randomRange(...sceneDef.zoomSpeedRange),
        AUTO_ZOOM_MIN_SPEED,
        AUTO_ZOOM_MAX_SPEED,
      );
      autoZoomSpeedRef.current = nextSpeed;
      setAutoZoomSpeed(nextSpeed);

      const nextDirection = sceneDef.zoomDirection;
      autoZoomDirectionRef.current = nextDirection;
      setAutoZoomDirection(nextDirection);
      ambient.zoomOutTimer = nextDirection === 1 ? ZOOM_OUT_MAX_SECONDS : 0;
      ambient.zoomDirectionCooldown =
        nextDirection === 1 ? ZOOM_OUT_MAX_SECONDS : ZOOM_DIRECTION_COOLDOWN_SECONDS;

      ambient.paletteCooldown = PALETTE_COOLDOWN_SECONDS * 0.6;
      ambient.variantCooldown = VARIANT_COOLDOWN_SECONDS * 0.75;
      ambient.typeCooldown = FRACTAL_TYPE_COOLDOWN_SECONDS * 0.75;
      ambient.mutationElapsed = 0;
      ambient.mutationInterval = randomRange(MUTATION_INTERVAL_MIN, MUTATION_INTERVAL_MAX);

      const sceneLabel = sceneDef.name.replace(/-/g, ' ');
      setStatusMessage(`Scene shift: ${sceneLabel}`);

      if (sceneDef.paletteBias && sceneDef.paletteBias.length && Math.random() < 0.7) {
        let nextPalette = pickFrom(sceneDef.paletteBias);
        if (nextPalette === paletteIndexRef.current) {
          nextPalette = (nextPalette + 1) % FRACTAL_PALETTES.length;
        }
        paletteIndexRef.current = nextPalette;
        setPaletteIndex(nextPalette);
        setStatusMessage((prev) =>
          prev ? `${prev} • Palette ${nextPalette + 1} tuned` : `Palette ${nextPalette + 1} tuned`,
        );
      }

      if (
        fractalTypeRef.current === 'mandelbrot' &&
        sceneDef.variantBias &&
        sceneDef.variantBias.length &&
        Math.random() < 0.65
      ) {
        const nextVariant = pickFrom(sceneDef.variantBias);
        fractalVariantRef.current = nextVariant;
        setFractalVariant(nextVariant);
        updateFocusTarget(ambient.sceneTargetScale);
        setStatusMessage((prev) =>
          prev
            ? `${prev} • Variant shift: ${formatVariantLabel(nextVariant)}`
            : `Variant shift: ${formatVariantLabel(nextVariant)}`,
        );
      }

      if (fractalTypeRef.current === 'julia' && Math.random() < 0.55) {
        const nextSeed = randomJuliaSeed();
        juliaSeedRef.current = nextSeed;
        setJuliaSeed(nextSeed);
      }

      if (sceneDef.name === 'deep-dive') {
        const maxShift = view.scale * 0.35;
        view.baseCenterX += (Math.random() - 0.5) * maxShift;
        view.baseCenterY += (Math.random() - 0.5) * maxShift;
      }
    },
    [
      setAutoZoomSpeed,
      setAutoZoomDirection,
      setPaletteIndex,
      setStatusMessage,
      setJuliaSeed,
      setFractalVariant,
      setActivePreset,
      updateFocusTarget,
    ],
  );

  useEffect(() => {
    applyScene(pickSceneDefinition(null));
  }, [applyScene]);

  const alignViewToType = useCallback(
    (type, options = {}) => {
      const { resetScale = true, recenter = resetScale } = options;
      const view = viewRef.current;
      if (recenter) {
        view.baseCenterX = type === 'mandelbrot' ? -0.5 : 0;
        view.baseCenterY = 0;
      }

      if (resetScale) {
        view.scale = INITIAL_VIEW_SCALE;
        const ambient = ambientStateRef.current;
        ambient.zoomOutTimer = 0;
        ambient.zoomDirectionCooldown = ZOOM_DIRECTION_COOLDOWN_SECONDS;
        ambient.sceneTargetScale = INITIAL_VIEW_SCALE;
        updateFocusTarget(INITIAL_VIEW_SCALE);

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
    [setAutoZoomDirection, setAutoZoomSpeed, updateFocusTarget],
  );

  const runFractalMutation = useCallback(() => {
    const updates = [];
    const choices = [];

    const ambient = ambientStateRef.current;
    const currentScene = ambient.sceneName;
    const sceneBoost =
      currentScene === 'deep-dive' ? 0.18 : currentScene === 'cosmic-orbit' ? 0.12 : 0;
    const paletteChance = PALETTE_MUTATION_CHANCE + sceneBoost;

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
    if (ambient.paletteCooldown <= 0 && Math.random() < paletteChance) {
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
      ambient.typeCooldown = FRACTAL_TYPE_COOLDOWN_SECONDS;
      const nextScene = pickSceneDefinition(ambient.sceneName);
      applyScene(nextScene);
      if (nextType === 'julia') {
        const nextSeed = randomJuliaSeed();
        juliaSeedRef.current = nextSeed;
        setJuliaSeed(nextSeed);
        updates.push('Fractal reforms as a Julia bloom');
      } else {
        updates.push('Fractal reforms as a Mandelbrot bloom');
      }
    };
    if (ambient.typeCooldown <= 0) {
      choices.push(toggleFractalType);
    }

    const mutateVariant = () => {
      const currentVariant = fractalVariantRef.current;
      const options = FRACTAL_VARIANTS.filter((variant) => variant !== currentVariant);
      const nextVariant = options[Math.floor(Math.random() * options.length)];
      fractalVariantRef.current = nextVariant;
      setFractalVariant(nextVariant);
      updateFocusTarget(ambient.sceneTargetScale);
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
      let nextDirection = Math.random() > 0.78 ? 1 : -1;
      if (nextDirection === 1 && viewRef.current.scale >= MAX_VIEW_SCALE * 0.8) {
        nextDirection = -1;
      }
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

    const refocusDeeper = () => {
      const ambient = ambientStateRef.current;
      ambient.sceneTargetScale = clamp(
        ambient.sceneTargetScale * randomRange(0.12, 0.28),
        MIN_VIEW_SCALE,
        MAX_VIEW_SCALE * 0.5,
      );
      updateFocusTarget(ambient.sceneTargetScale);
      updates.push('Zoom focus plunges deeper');
    };
    choices.push(refocusDeeper);

    const actionsToRun = Math.min(choices.length, Math.random() > 0.6 ? 2 : 1);

    for (let i = 0; i < actionsToRun && choices.length; i += 1) {
      const index = Math.floor(Math.random() * choices.length);
      const action = choices.splice(index, 1)[0];
      action();
    }

    if (!updates.length) {
      mutateAmbientRhythm();
    }

    if (updates.length) {
      setStatusMessage(updates.join(' • '));
    }
  }, [
    applyScene,
    alignViewToType,
    setAutoZoomSpeed,
    setAutoZoomDirection,
    setFractalType,
    setFractalVariant,
    setJuliaSeed,
    setPaletteIndex,
    setStatusMessage,
    updateFocusTarget,
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
      ambient.orbitPhase += deltaSeconds * (0.12 + Math.sin(ambient.breathePhase * 0.8) * 0.05);

      const driftIntensityBase = 0.42 + Math.sin(ambient.breathePhase * 0.9) * 0.14;
      const driftIntensity = driftIntensityBase * (1 + ambient.sceneShiftIntensity);
      ambient.driftOffsetX = Math.cos(ambient.driftPhase) * driftIntensity;
      ambient.driftOffsetY = Math.sin(ambient.driftPhase * 1.25) * driftIntensity;
      ambient.paletteCooldown = Math.max(0, ambient.paletteCooldown - deltaSeconds);
      ambient.variantCooldown = Math.max(0, ambient.variantCooldown - deltaSeconds);
      ambient.seedCooldown = Math.max(0, ambient.seedCooldown - deltaSeconds);
      ambient.zoomDirectionCooldown = Math.max(0, ambient.zoomDirectionCooldown - deltaSeconds);
      ambient.typeCooldown = Math.max(0, ambient.typeCooldown - deltaSeconds);
      if (ambient.zoomOutTimer > 0) {
        ambient.zoomOutTimer = Math.max(0, ambient.zoomOutTimer - deltaSeconds);
        if (ambient.zoomOutTimer === 0 && autoZoomDirectionRef.current === 1) {
          autoZoomDirectionRef.current = -1;
          setAutoZoomDirection(-1);
        }
      }

      ambient.sceneElapsed += deltaSeconds;
      const activeScene = SCENE_DEFINITIONS.find((scene) => scene.name === ambient.sceneName);
      if (!activeScene) {
        applyScene(pickSceneDefinition(null));
      } else if (ambient.sceneElapsed >= ambient.sceneDuration) {
        applyScene(pickSceneDefinition(activeScene.name));
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
      if (mutationsEnabledRef.current && ambient.mutationElapsed >= ambient.mutationInterval) {
        ambient.mutationElapsed = 0;
        ambient.mutationInterval = randomRange(MUTATION_INTERVAL_MIN, MUTATION_INTERVAL_MAX);
        runFractalMutation();
      } else if (!mutationsEnabledRef.current) {
        ambient.mutationElapsed = 0;
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [applyScene, runFractalMutation]);

  const handlePaletteShuffle = useCallback(() => {
    let next = Math.floor(Math.random() * FRACTAL_PALETTES.length);
    if (next === paletteIndex) {
      next = (next + 1) % FRACTAL_PALETTES.length;
    }
    paletteIndexRef.current = next;
    setPaletteIndex(next);
    setStatusMessage(`Palette ${next + 1} loaded`);
  }, [paletteIndex]);

  const handleFractalToggle = useCallback(() => {
    const next = fractalType === 'mandelbrot' ? 'julia' : 'mandelbrot';
    fractalTypeRef.current = next;
    fractalVariantRef.current = 'classic';
    setFractalVariant('classic');
    const ambient = ambientStateRef.current;
    ambient.variantCooldown = VARIANT_COOLDOWN_SECONDS;
    ambient.paletteCooldown = PALETTE_COOLDOWN_SECONDS * 0.5;
    ambient.typeCooldown = FRACTAL_TYPE_COOLDOWN_SECONDS;
    setFractalType(next);
    if (next === 'julia') {
      const nextSeed = randomJuliaSeed();
      juliaSeedRef.current = nextSeed;
      setJuliaSeed(nextSeed);
    }
    alignViewToType(next);
    const nextScene = pickSceneDefinition(ambient.sceneName);
    applyScene(nextScene);
    const variantLabel =
      next === 'mandelbrot' ? formatVariantLabel(fractalVariantRef.current) : 'classic';
    setStatusMessage((prev) =>
      prev
        ? `${prev} • Exploring the ${next === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} set (${variantLabel})`
        : `Exploring the ${next === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} set (${variantLabel})`,
    );
  }, [alignViewToType, applyScene, fractalType]);

  const handleFractalReshuffle = useCallback(() => {
    const nextType = Math.random() > 0.5 ? 'mandelbrot' : 'julia';
    fractalTypeRef.current = nextType;
    const nextVariant =
      nextType === 'mandelbrot'
        ? FRACTAL_VARIANTS[Math.floor(Math.random() * FRACTAL_VARIANTS.length)]
        : 'classic';
    fractalVariantRef.current = nextVariant;
    setFractalVariant(nextVariant);
    const ambient = ambientStateRef.current;
    ambient.variantCooldown = VARIANT_COOLDOWN_SECONDS;
    ambient.paletteCooldown = PALETTE_COOLDOWN_SECONDS;
    ambient.typeCooldown = FRACTAL_TYPE_COOLDOWN_SECONDS;
    setFractalType(nextType);
    if (nextType === 'julia') {
      const nextSeed = randomJuliaSeed();
      juliaSeedRef.current = nextSeed;
      setJuliaSeed(nextSeed);
    }
    alignViewToType(nextType);
    const nextScene = pickSceneDefinition(ambient.sceneName);
    applyScene(nextScene);

    let nextPalette = Math.floor(Math.random() * FRACTAL_PALETTES.length);
    if (nextPalette === paletteIndex) {
      nextPalette = (nextPalette + 1) % FRACTAL_PALETTES.length;
    }
    paletteIndexRef.current = nextPalette;
    setPaletteIndex(nextPalette);

    const labelType = nextType === 'mandelbrot' ? 'Mandelbrot' : 'Julia';
    const variantLabel =
      nextType === 'mandelbrot' ? ` (${formatVariantLabel(fractalVariantRef.current)})` : '';
    setStatusMessage((prev) =>
      prev
        ? `${prev} • Shuffled to the ${labelType}${variantLabel} set with palette ${nextPalette + 1}`
        : `Shuffled to the ${labelType}${variantLabel} set with palette ${nextPalette + 1}`,
    );
  }, [alignViewToType, applyScene, paletteIndex]);

  const handleJuliaReseed = useCallback(() => {
    const nextSeed = randomJuliaSeed();
    juliaSeedRef.current = nextSeed;
    setJuliaSeed(nextSeed);
    alignViewToType('julia', { resetScale: false, recenter: false });
    updateFocusTarget(viewRef.current.scale);
    setStatusMessage('Generated a new Julia seed');
  }, [alignViewToType, updateFocusTarget]);

  const handleManualZoom = useCallback((direction) => {
    const view = viewRef.current;
    const factor = direction === 'in' ? 0.8 : 1.25;
    view.scale = clamp(view.scale * factor, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
    ambientStateRef.current.sceneTargetScale = view.scale;
    updateFocusTarget(view.scale);
    setStatusMessage(`Manual zoom ${direction === 'in' ? 'in' : 'out'}`);
  }, [updateFocusTarget]);

  const handleResetView = useCallback(() => {
    alignViewToType(fractalType);
    setStatusMessage('View reset to default framing');
  }, [alignViewToType, fractalType]);

  const handleAutoZoomDirectionToggle = useCallback(() => {
    let next = autoZoomDirection === -1 ? 1 : -1;
    if (next === 1 && viewRef.current.scale >= MAX_VIEW_SCALE * 0.8) {
      next = -1;
    }
    autoZoomDirectionRef.current = next;
    setAutoZoomDirection(next);
    setStatusMessage(`Auto zoom flowing ${next === -1 ? 'inward' : 'outward'}`);
  }, [autoZoomDirection]);

  const handleVariantChange = useCallback((event) => {
    const nextVariant = event.target.value;
    fractalVariantRef.current = nextVariant;
    setFractalVariant(nextVariant);
    const ambient = ambientStateRef.current;
    ambient.variantCooldown = VARIANT_COOLDOWN_SECONDS;
    updateFocusTarget(ambient.sceneTargetScale);
    setStatusMessage(`Variant set to ${formatVariantLabel(nextVariant)}`);
  }, [updateFocusTarget]);

  const handleMutationsToggle = useCallback(() => {
    const next = !mutationsEnabledRef.current;
    mutationsEnabledRef.current = next;
    setMutationsEnabled(next);
    const ambient = ambientStateRef.current;
    ambient.mutationElapsed = 0;
    if (next) {
      ambient.mutationInterval = randomRange(MUTATION_INTERVAL_MIN, MUTATION_INTERVAL_MAX);
    }
    setStatusMessage(`Auto mutations ${next ? 'resumed' : 'paused'}`);
  }, []);

  const handlePresetSelect = useCallback(
    (presetName) => {
      if (!presetName || ambientStateRef.current.sceneName === presetName) {
        return;
      }
      const scene = SCENE_DEFINITIONS.find((sceneDef) => sceneDef.name === presetName);
      if (scene) {
        applyScene(scene);
        setStatusMessage(`Preset tuned to ${scene.name.replace(/-/g, ' ')}`);
      }
    },
    [applyScene, setStatusMessage],
  );

  const handleAutoZoomSliderChange = useCallback((event) => {
    const nextPercent = Number(event.target.value);
    const nextSpeed = percentToAutoZoomSpeed(nextPercent);
    autoZoomSpeedRef.current = nextSpeed;
    setAutoZoomSpeed(nextSpeed);
  }, []);

  const handleFullscreenToggle = useCallback(async () => {
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
      console.warn('[FractalControls] Fullscreen toggle failed:', error);
      setStatusMessage('Fullscreen not available');
    }
  }, []);

  const computeRenderPayload = useCallback(
    ({ deltaSeconds, width, height }) => {
      const view = viewRef.current;
      const ambient = ambientStateRef.current;

      if (ambient.focusTarget) {
        const focusBlend = 1 - Math.pow(FOCUS_INTERPOLATION, deltaSeconds * 60);
        view.baseCenterX += (ambient.focusTarget.x - view.baseCenterX) * focusBlend;
        view.baseCenterY += (ambient.focusTarget.y - view.baseCenterY) * focusBlend;
      }

      const aspectRatio = height / width;
      const scaledHeight = view.scale * aspectRatio;
      const pointerOffsetX = 0;
      const pointerOffsetY = 0;

      const driftAttenuation = clamp(view.scale / 0.35, 0.05, 1);
      const driftOffsetX = ambient.driftOffsetX * view.scale * 0.45 * driftAttenuation;
      const driftOffsetY = ambient.driftOffsetY * scaledHeight * 0.45 * driftAttenuation;

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

      const zoomRate = autoZoomSpeedRef.current;
      const zoomDirection = autoZoomDirectionRef.current;
      const currentScale = view.scale;

      const perSecondMultiplier = zoomDirection === -1 ? 1 - zoomRate : 1 + zoomRate;

      const timeBasedMultiplier = Math.pow(perSecondMultiplier, deltaSeconds);
      const targetScale = ambient.sceneTargetScale || currentScale;
      const scaleRatio = targetScale / Math.max(currentScale, 1e-9);
      const targetBias = Math.pow(scaleRatio, 0.35);
      const guidedMultiplier =
        zoomDirection === -1
          ? clamp(timeBasedMultiplier * targetBias, 0.6, 0.98)
          : clamp(timeBasedMultiplier / Math.max(targetBias, 1e-6), 1.05, 1.45);
      const rawTargetScale = currentScale * guidedMultiplier;
      const pulseWave = 1 + Math.sin(ambient.pulsePhase) * 0.11;
      const breatheWave =
        1 + Math.sin(ambient.breathePhase * 0.9 + ambient.pulsePhase * 0.33) * 0.06;
      const organicMultiplier = Math.max(0.78, pulseWave * breatheWave);
      const perFrameDamping = 1 - Math.pow(0.92, deltaSeconds * 60);
      const easedTargetScale =
        currentScale +
        (rawTargetScale * organicMultiplier - currentScale) * perFrameDamping;

      const zoomSmoothing = 1 - Math.pow(ZOOM_SMOOTHING_FACTOR, deltaSeconds * 60);
      view.scale = clamp(
        currentScale + (easedTargetScale - currentScale) * zoomSmoothing,
        MIN_VIEW_SCALE,
        MAX_VIEW_SCALE,
      );

      if (Math.abs(Math.log(view.scale / Math.max(ambient.sceneTargetScale, 1e-12))) < 0.08) {
        ambient.sceneElapsed = ambient.sceneDuration;
      }

      return message;
    },
    [],
  );

  const autoZoomPercent = Math.round(autoZoomSpeedToPercent(autoZoomSpeed));
  const currentVariantLabel =
    fractalType === 'mandelbrot' ? formatVariantLabel(fractalVariant) : 'classic';

  return {
    canvasRef,
    containerRef,
    paletteData,
    statusMessage,
    fractalType,
    fractalVariant,
    paletteIndex,
    juliaSeed,
    autoZoomSpeed,
    autoZoomDirection,
    autoZoomPercent,
    isFullscreen,
    mutationsEnabled,
    currentVariantLabel,
    presetOptions,
    activePreset,
    constants: {
      AUTO_ZOOM_MIN_PERCENT,
      AUTO_ZOOM_MAX_PERCENT,
      MIN_RENDER_INTERVAL,
      MAX_DEVICE_PIXEL_RATIO,
      FRACTAL_VARIANTS,
    },
    handlers: {
      handlePaletteShuffle,
      handleFractalToggle,
      handleFractalReshuffle,
      handleJuliaReseed,
      handleManualZoom,
      handleResetView,
      handleAutoZoomDirectionToggle,
      handleMutationsToggle,
      handleVariantChange,
      handleAutoZoomSliderChange,
      handleFullscreenToggle,
      handlePresetSelect,
    },
    engine: {
      computeRenderPayload,
    },
  };
}

export default useFractalControls;

