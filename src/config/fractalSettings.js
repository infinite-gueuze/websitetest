export const FRACTAL_PALETTES = Object.freeze([
  ['#ff6b6b', '#f06595', '#845ef7', '#5c7cfa', '#51cf66', '#ffd43b'],
  ['#f97316', '#e11d48', '#a855f7', '#6366f1', '#22d3ee', '#14b8a6'],
  ['#b91c1c', '#f97316', '#facc15', '#84cc16', '#22c55e', '#0ea5e9'],
  ['#f43f5e', '#d946ef', '#8b5cf6', '#6366f1', '#0ea5e9', '#06b6d4'],
  ['#fb7185', '#f9a8d4', '#c4b5fd', '#93c5fd', '#67e8f9', '#6ee7b7'],
  ['#f97316', '#fb7185', '#f472b6', '#a855f7', '#22d3ee', '#4ade80'],
]);

export const FRACTAL_VARIANTS = Object.freeze(['classic', 'cubic', 'burning-ship', 'perpendicular']);

export const FRACTAL_CONSTANTS = Object.freeze({
  MIN_RENDER_INTERVAL: 5,
  MAX_DEVICE_PIXEL_RATIO: 2,
  ZOOM_SMOOTHING_FACTOR: 0.85,
  AUTO_ZOOM_MIN_PERCENT: 1,
  AUTO_ZOOM_MAX_PERCENT: 100,
  AUTO_ZOOM_MIN_SPEED: 0.001,
  AUTO_ZOOM_MAX_SPEED: 0.018,
  PALETTE_COOLDOWN_SECONDS: 24,
  VARIANT_COOLDOWN_SECONDS: 32,
  JULIA_COOLDOWN_SECONDS: 20,
  MUTATION_INTERVAL_MIN: 12,
  MUTATION_INTERVAL_MAX: 20,
  ZOOM_DIRECTION_COOLDOWN_SECONDS: 6,
  ZOOM_OUT_MAX_SECONDS: 1.8,
  FRACTAL_TYPE_COOLDOWN_SECONDS: 26,
  PALETTE_MUTATION_CHANCE: 0.22,
  INITIAL_VIEW_SCALE: 0.9,
  MAX_VIEW_SCALE: 1.1,
  MIN_VIEW_SCALE: 0.00003,
  FOCUS_INTERPOLATION: 0.92,
});

export const FOCUS_PRESETS = Object.freeze({
  mandelbrot: {
    classic: [
      { scale: 1.2, center: { x: -0.5, y: 0 } },
      { scale: 0.35, center: { x: -0.7453, y: 0.1127 } },
      { scale: 0.12, center: { x: -1.25506, y: 0.3819 } },
      { scale: 0.045, center: { x: -0.7746809, y: 0.1374169 } },
      { scale: 0.02, center: { x: -0.7436438870371587, y: 0.13182590420531198 } },
      { scale: 0.0085, center: { x: -0.745507, y: 0.112531 } },
      { scale: 0.0022, center: { x: -0.743904, y: 0.131161 } },
    ],
    cubic: [
      { scale: 1.2, center: { x: -0.48, y: 0 } },
      { scale: 0.26, center: { x: -0.389, y: 0.312 } },
      { scale: 0.082, center: { x: -0.16, y: 0.652 } },
      { scale: 0.028, center: { x: -0.06, y: 0.835 } },
      { scale: 0.009, center: { x: -0.02, y: 0.91 } },
    ],
    'burning-ship': [
      { scale: 1.2, center: { x: -1.75, y: -0.02 } },
      { scale: 0.22, center: { x: -1.8, y: -0.1 } },
      { scale: 0.08, center: { x: -1.73, y: -0.18 } },
      { scale: 0.028, center: { x: -1.75488, y: -0.03 } },
      { scale: 0.009, center: { x: -1.75465, y: -0.025 } },
    ],
    perpendicular: [
      { scale: 1.2, center: { x: -0.123, y: -0.745 } },
      { scale: 0.28, center: { x: -0.29, y: -0.62 } },
      { scale: 0.09, center: { x: -0.44, y: -0.55 } },
      { scale: 0.032, center: { x: -0.51, y: -0.48 } },
      { scale: 0.011, center: { x: -0.538, y: -0.462 } },
    ],
  },
});

export const SCENE_DEFINITIONS = Object.freeze([
  {
    name: 'deep-dive',
    durationRange: [18, 26],
    zoomDirection: -1,
    zoomSpeedRange: [0.0075, 0.013],
    targetScaleRange: [0.00018, 0.0012],
    shiftIntensity: 0.26,
    variantBias: ['classic', 'burning-ship'],
    paletteBias: [0, 2, 3],
  },
  {
    name: 'breathing-bloom',
    durationRange: [16, 24],
    zoomDirection: 1,
    zoomSpeedRange: [0.004, 0.007],
    targetScaleRange: [0.8, 1.7],
    shiftIntensity: 0.18,
    variantBias: ['cubic', 'perpendicular'],
    paletteBias: [1, 4, 5],
  },
  {
    name: 'cosmic-orbit',
    durationRange: [20, 30],
    zoomDirection: -1,
    zoomSpeedRange: [0.0055, 0.009],
    targetScaleRange: [0.004, 0.018],
    shiftIntensity: 0.4,
    variantBias: ['classic'],
    paletteBias: [2, 3, 5],
  },
]);

export const FRACTAL_SETTINGS = Object.freeze({
  palettes: FRACTAL_PALETTES,
  variants: FRACTAL_VARIANTS,
  focusPresets: FOCUS_PRESETS,
  scenes: SCENE_DEFINITIONS,
  constants: FRACTAL_CONSTANTS,
});

export default FRACTAL_SETTINGS;

